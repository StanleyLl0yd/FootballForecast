-- M2 private seven-season RPL research observations: no public grants or holdout data.
-- Source eligibility is observational only; this table cannot approve model training.
create table ff_private.ff_rpl_history_snapshots (
  id uuid primary key default gen_random_uuid(),
  season text not null check (season in (
    '2018/19','2019/20','2020/21','2021/22','2022/23','2023/24','2024/25'
  )),
  source_name text not null default 'OpenFoot Starter'
    check (source_name = 'OpenFoot Starter'),
  collection_method text not null default 'official_free_team_filtered_api'
    check (collection_method = 'official_free_team_filtered_api'),
  terms_url text not null default 'https://openfootapi.com/terms'
    check (terms_url = 'https://openfootapi.com/terms'),
  source_responses_sha256 text not null check (source_responses_sha256 ~ '^[a-f0-9]{64}$'),
  normalized_rows_sha256 text not null check (normalized_rows_sha256 ~ '^[a-f0-9]{64}$'),
  retrieved_at timestamptz not null,
  github_run_id bigint not null check (github_run_id > 0),
  source_response_pages integer not null check (source_response_pages = 17),
  fixture_count integer not null check (fixture_count = 240),
  research_role text not null default 'development_source_only'
    check (research_role = 'development_source_only'),
  historical_prematch_verified boolean not null default false
    check (historical_prematch_verified = false),
  model_training_approved boolean not null default false
    check (model_training_approved = false),
  holdout_read boolean not null default false check (holdout_read = false),
  created_at timestamptz not null default now(),
  unique (season, normalized_rows_sha256),
  unique (season, source_responses_sha256)
);

create table ff_private.ff_rpl_history_matches (
  snapshot_id uuid not null references ff_private.ff_rpl_history_snapshots(id),
  source_match_id text not null check (length(source_match_id) between 2 and 160),
  home_team_id text not null check (length(home_team_id) between 2 and 160),
  away_team_id text not null check (length(away_team_id) between 2 and 160),
  kickoff_at timestamptz not null,
  status text not null default 'finished' check (status = 'finished'),
  home_goals smallint not null check (home_goals between 0 and 20),
  away_goals smallint not null check (away_goals between 0 and 20),
  source_publication_at timestamptz,
  historical_prematch_verified boolean not null default false
    check (historical_prematch_verified = false),
  primary key (snapshot_id, source_match_id),
  unique (snapshot_id, home_team_id, away_team_id),
  check (home_team_id <> away_team_id),
  check (source_publication_at is null)
);
create index ff_rpl_history_matches_kickoff_idx
  on ff_private.ff_rpl_history_matches(snapshot_id, kickoff_at);

-- Prevent publication of incomplete or cross-season snapshots at commit.
-- The trigger fires only after inserting a snapshot; the 240 matches must be
-- added in the same transaction before deferred constraints are checked.
create function ff_private.ff_rpl_history_assert_complete()
returns trigger language plpgsql set search_path = '' as $m2$
declare
  v_count integer;
  v_clubs integer;
  v_bad_clubs integer;
  v_year integer;
  v_end timestamptz;
begin
  v_year := substring(new.season from 1 for 4)::integer;
  v_end := case when new.season='2019/20'
    then '2020-08-01T00:00:00Z'::timestamptz
    else make_timestamptz(v_year+1,7,1,0,0,0,'UTC') end;
  select count(*) into v_count from ff_private.ff_rpl_history_matches r
    where r.snapshot_id = new.id;
  if v_count <> 240 or exists (
    select 1 from ff_private.ff_rpl_history_matches r
    where r.snapshot_id = new.id and
      (r.kickoff_at < make_timestamptz(v_year,7,1,0,0,0,'UTC')
       or r.kickoff_at >= v_end or r.source_publication_at is not null)
  ) then
    raise exception 'RPL private history: incomplete or out-of-season snapshot';
  end if;
  select count(*),count(*) filter (where homes<>15 or aways<>15)
    into v_clubs,v_bad_clubs
  from (
    select club,sum(home) as homes,sum(away) as aways
    from (
      select r.home_team_id as club,1 as home,0 as away
      from ff_private.ff_rpl_history_matches r where r.snapshot_id = new.id
      union all
      select r.away_team_id,0,1
      from ff_private.ff_rpl_history_matches r where r.snapshot_id = new.id
    ) sides group by club
  ) team_coverage;
  if v_clubs<>16 or v_bad_clubs<>0 then
    raise exception 'RPL private history: invalid 16-club 15/15 home-away coverage';
  end if;
  return null;
end;
$m2$;

revoke all on function ff_private.ff_rpl_history_assert_complete()
  from public,anon,authenticated,service_role;
create constraint trigger ff_rpl_history_snapshot_complete
  after insert on ff_private.ff_rpl_history_snapshots
  deferrable initially deferred
  for each row execute function ff_private.ff_rpl_history_assert_complete();

alter table ff_private.ff_rpl_history_snapshots enable row level security;
alter table ff_private.ff_rpl_history_matches enable row level security;
alter table ff_private.ff_rpl_history_snapshots force row level security;
alter table ff_private.ff_rpl_history_matches force row level security;
revoke all on ff_private.ff_rpl_history_snapshots,
  ff_private.ff_rpl_history_matches from public,anon,authenticated,service_role;

create trigger ff_rpl_history_snapshots_immutable
  before update or delete on ff_private.ff_rpl_history_snapshots
  for each row execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_rpl_history_snapshots_no_truncate
  before truncate on ff_private.ff_rpl_history_snapshots
  for each statement execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_rpl_history_matches_immutable
  before update or delete on ff_private.ff_rpl_history_matches
  for each row execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_rpl_history_matches_no_truncate
  before truncate on ff_private.ff_rpl_history_matches
  for each statement execute function ff_private.ff_reject_ingest_mutation();

comment on table ff_private.ff_rpl_history_snapshots is
  'Owner-only immutable RPL historical source snapshots. Research input only; '
  'no model training approval, publication claim or sealed holdout.';
comment on table ff_private.ff_rpl_history_matches is
  'Private normalized historical source fixtures. No verified original '
  'publication time; never interpret as strict pre-match as-of evidence.';
