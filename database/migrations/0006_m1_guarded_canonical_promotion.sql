-- M1: guarded canonical RPL promotion from an immutable, quality-gated snapshot.
-- Not an automatic ingestion trigger; only privileged postgres can explicitly invoke it.
-- Unknown exact kickoffs are never projected into NOT NULL public.ff_matches.
create table if not exists ff_private.ff_provider_team_links (
  source_id uuid not null references public.ff_sources(id),
  provider_team_id text not null check (length(provider_team_id) between 1 and 100),
  team_id uuid not null references public.ff_teams(id),
  primary key (source_id,provider_team_id),
  unique (source_id,team_id)
);
create table if not exists ff_private.ff_published_fixture_links (
  snapshot_id uuid not null,
  source_match_id text not null,
  match_id uuid not null references public.ff_matches(id),
  created_at timestamptz not null default now(),
  primary key(snapshot_id,source_match_id),
  unique(snapshot_id,match_id),
  foreign key (snapshot_id,source_match_id)
    references ff_private.ff_ingest_matches(snapshot_id,source_match_id)
);

alter table ff_private.ff_provider_team_links enable row level security;
alter table ff_private.ff_published_fixture_links enable row level security;
revoke all on ff_private.ff_provider_team_links,
  ff_private.ff_published_fixture_links from public,anon,authenticated;

-- These associations are provenance: corrections require explicit reviewed migrations.
create trigger ff_provider_team_links_immutable
  before update or delete on ff_private.ff_provider_team_links
  for each row execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_published_fixture_links_immutable
  before update or delete on ff_private.ff_published_fixture_links
  for each row execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_provider_team_links_no_truncate
  before truncate on ff_private.ff_provider_team_links
  for each statement execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_published_fixture_links_no_truncate
  before truncate on ff_private.ff_published_fixture_links
  for each statement execute function ff_private.ff_reject_ingest_mutation();

create function ff_private.ff_promote_footbolno_snapshot(p_snapshot uuid)
returns jsonb
language plpgsql security invoker set search_path = ''
as $m1$
declare
  v_source uuid;
  v_hash text;
  v_total integer;
  v_eligible integer;
  v_mapped integer;
begin
  -- A manual privileged command only, serialized across source snapshots.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('footballforecast-m1-canonical-promotion'));
  select s.source_id,s.source_sha256 into v_source,v_hash
  from ff_private.ff_ingest_snapshots s
    join public.ff_sources src on src.id=s.source_id
  where s.id=p_snapshot and src.name='Footbolno'
    and src.license_status='approved'
    and src.license_reference='https://footbolno.ru/otkrytye-dannye'
    and s.source_url='https://footbolno.ru/data/league/235-matches.csv'
    and s.license_url=src.license_reference;
  if v_source is null then
    raise exception 'M1 promotion: approved source snapshot not found';
  end if;

  select count(*) into v_total from ff_private.ff_ingest_matches
  where snapshot_id=p_snapshot;
  if v_total<>720 or
    (select count(distinct season) from ff_private.ff_ingest_matches
       where snapshot_id=p_snapshot)<>3 or
    exists(select 1 from ff_private.ff_ingest_matches
       where snapshot_id=p_snapshot group by season having count(*)<>240) or
    exists(select 1 from ff_private.ff_ingest_matches
       where snapshot_id=p_snapshot and (
         quarantine_reason is not null or published_at is not null or
         status not in ('finished','scheduled') or
         kickoff_time_confirmed is distinct from (kickoff_at is not null) or
         (status='finished' and
           (kickoff_at is null or home_goals is null or away_goals is null)) or
         (status='scheduled' and
           (home_goals is not null or away_goals is not null)))) or
    exists(select 1 from ff_private.ff_ingest_matches
      where snapshot_id=p_snapshot and
      ((season='2024/2025' and (dataset_role<>'train_baseline' or status<>'finished')) or
       (season='2025/2026' and (dataset_role<>'sealed_holdout' or status<>'finished')) or
       (season='2026/2027' and dataset_role<>'current'))) or
    exists(
      select 1 from (
        select season,home_source_id as team_id from ff_private.ff_ingest_matches
          where snapshot_id=p_snapshot
        union all
        select season,away_source_id from ff_private.ff_ingest_matches
          where snapshot_id=p_snapshot
      ) t group by season having count(distinct team_id)<>16
    ) then
    raise exception 'M1 promotion: source quality, provenance or role check failed';
  end if;

  -- One provider ID has one display name and vice versa; never guess aliases.
  if exists(
    select 1 from (
      select home_source_id as provider_id,home_name as display_name
        from ff_private.ff_ingest_matches where snapshot_id=p_snapshot
      union all
      select away_source_id,away_name from ff_private.ff_ingest_matches
        where snapshot_id=p_snapshot
    ) t group by provider_id having count(distinct display_name)<>1
  ) or exists(
    select 1 from (
      select home_source_id as provider_id,home_name as display_name
        from ff_private.ff_ingest_matches where snapshot_id=p_snapshot
      union all
      select away_source_id,away_name from ff_private.ff_ingest_matches
        where snapshot_id=p_snapshot
    ) t group by display_name having count(distinct provider_id)<>1
  ) then
    raise exception 'M1 promotion: ambiguous provider team identity';
  end if;

  insert into public.ff_competitions(code,name,timezone)
  values('RPL','Российская Премьер-Лига','Europe/Moscow')
  on conflict(code) do nothing;
  if not exists (select 1 from public.ff_competitions
    where code='RPL' and timezone='Europe/Moscow') then
    raise exception 'M1 promotion: competing league catalog';
  end if;

  insert into public.ff_seasons(competition_id,name)
  select c.id,n.season from public.ff_competitions c
  cross join (values('2024/2025'),('2025/2026'),('2026/2027')) n(season)
  where c.code='RPL'
  on conflict(competition_id,name) do nothing;

  -- "normalized_name" is an explicit provider-key namespace, not a fuzzy match.
  with all_names as (
    select home_source_id as pid,home_name as label from ff_private.ff_ingest_matches
      where snapshot_id=p_snapshot
    union
    select away_source_id,away_name from ff_private.ff_ingest_matches
      where snapshot_id=p_snapshot
  )
  insert into public.ff_teams(name,normalized_name)
  select label,'footbolno:'||pid from all_names
  on conflict(normalized_name) do nothing;

  with all_names as (
    select home_source_id as pid,home_name as label from ff_private.ff_ingest_matches
      where snapshot_id=p_snapshot
    union
    select away_source_id,away_name from ff_private.ff_ingest_matches
      where snapshot_id=p_snapshot
  )
  insert into ff_private.ff_provider_team_links(source_id,provider_team_id,team_id)
  select v_source,n.pid,t.id from all_names n
    join public.ff_teams t on t.normalized_name='footbolno:'||n.pid
  on conflict(source_id,provider_team_id) do nothing;

  if exists(
    with all_names as (
      select home_source_id as pid,home_name as label from ff_private.ff_ingest_matches
        where snapshot_id=p_snapshot
      union
      select away_source_id,away_name from ff_private.ff_ingest_matches
        where snapshot_id=p_snapshot
    )
    select 1 from all_names n
      left join ff_private.ff_provider_team_links l
        on l.source_id=v_source and l.provider_team_id=n.pid
      left join public.ff_teams t on t.id=l.team_id
    where t.id is null or t.name<>n.label or
      t.normalized_name<>'footbolno:'||n.pid
  ) then
    raise exception 'M1 promotion: conflicting club mapping';
  end if;

  select count(*) into v_eligible from ff_private.ff_ingest_matches
  where snapshot_id=p_snapshot and kickoff_time_confirmed
    and kickoff_at is not null;
  if v_eligible<480 or v_eligible>720 then
    raise exception 'M1 promotion: invalid confirmed-kickoff coverage';
  end if;

  -- Public schema cannot store date-only fixtures. Never synthesize 00:00.
  insert into public.ff_matches
    (id,season_id,home_id,away_id,kickoff_at,status,home_goals,away_goals)
  select pg_catalog.md5('footballforecast:m1:'||v_source::text||':'||
      r.season||':'||r.home_source_id||':'||r.away_source_id)::uuid,
    season.id,h.team_id,a.team_id,r.kickoff_at,r.status,
    r.home_goals,r.away_goals
  from ff_private.ff_ingest_matches r
  join public.ff_competitions c on c.code='RPL'
  join public.ff_seasons season on season.competition_id=c.id
    and season.name=r.season
  join ff_private.ff_provider_team_links h
    on h.source_id=v_source and h.provider_team_id=r.home_source_id
  join ff_private.ff_provider_team_links a
    on a.source_id=v_source and a.provider_team_id=r.away_source_id
  where r.snapshot_id=p_snapshot and r.kickoff_time_confirmed
    and r.kickoff_at is not null
  on conflict(id) do nothing;

  if exists(
    select 1 from ff_private.ff_ingest_matches r
    join public.ff_competitions c on c.code='RPL'
    join public.ff_seasons season on season.competition_id=c.id
      and season.name=r.season
    join ff_private.ff_provider_team_links h
      on h.source_id=v_source and h.provider_team_id=r.home_source_id
    join ff_private.ff_provider_team_links a
      on a.source_id=v_source and a.provider_team_id=r.away_source_id
    left join public.ff_matches m
      on m.id=pg_catalog.md5('footballforecast:m1:'||v_source::text||':'||
        r.season||':'||r.home_source_id||':'||r.away_source_id)::uuid
    where r.snapshot_id=p_snapshot and r.kickoff_time_confirmed
      and (m.id is null or m.season_id is distinct from season.id
        or m.home_id is distinct from h.team_id
        or m.away_id is distinct from a.team_id
        or m.kickoff_at is distinct from r.kickoff_at
        or m.status is distinct from r.status
        or m.home_goals is distinct from r.home_goals
        or m.away_goals is distinct from r.away_goals)
  ) then
    raise exception 'M1 promotion: existing canonical fixture differs';
  end if;

  insert into ff_private.ff_published_fixture_links(snapshot_id,source_match_id,match_id)
  select r.snapshot_id,r.source_match_id,m.id
  from ff_private.ff_ingest_matches r
  join public.ff_competitions c on c.code='RPL'
  join public.ff_seasons season on season.competition_id=c.id
    and season.name=r.season
  join ff_private.ff_provider_team_links h
    on h.source_id=v_source and h.provider_team_id=r.home_source_id
  join ff_private.ff_provider_team_links a
    on a.source_id=v_source and a.provider_team_id=r.away_source_id
  join public.ff_matches m
    on m.id=pg_catalog.md5('footballforecast:m1:'||v_source::text||':'||
      r.season||':'||r.home_source_id||':'||r.away_source_id)::uuid
  where r.snapshot_id=p_snapshot and r.kickoff_time_confirmed
  on conflict(snapshot_id,source_match_id) do nothing;
  select count(*) into v_mapped from ff_private.ff_published_fixture_links
    where snapshot_id=p_snapshot;
  if v_mapped<>v_eligible then
    raise exception 'M1 promotion: canonical link coverage mismatch';
  end if;

  -- Publication date was not supplied by the source: leave published_at NULL.
  insert into public.ff_source_records
    (source_id,provider_id,source_version,event_at,published_at,content_hash)
  select v_source,r.source_match_id,v_hash,r.kickoff_at,null,
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      concat_ws('|',r.season,r.source_match_id,r.home_source_id,
        r.away_source_id,extract(epoch from r.kickoff_at)::text,
        r.status,coalesce(r.home_goals::text,''),
        coalesce(r.away_goals::text,''),v_hash),'UTF8')),'hex')
  from ff_private.ff_ingest_matches r
  where r.snapshot_id=p_snapshot and r.kickoff_time_confirmed
  on conflict(source_id,provider_id,content_hash) do nothing;

  return pg_catalog.jsonb_build_object(
    'snapshot_id',p_snapshot,'staged_rows',v_total,
    'public_rows_linked',v_mapped,
    'date_only_rows_private',v_total-v_eligible,
    'historical_prematch_publication_verified',false);
end;
$m1$;
revoke all on function ff_private.ff_promote_footbolno_snapshot(uuid)
  from public,anon,authenticated;
