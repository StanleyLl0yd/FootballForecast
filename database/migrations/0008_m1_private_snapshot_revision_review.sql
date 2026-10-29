-- M1: read-only, aggregate-only source-revision review before any public refresh.
-- Private and invoker-only; neither historical rows nor public matches are modified.
create function ff_private.ff_preview_footbolno_revision(p_candidate uuid)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $m1_review$
declare
  v_source uuid;
  v_base uuid;
  v_baseline_at timestamptz;
  v_candidate_at timestamptz;
  v_source_sha text;
  v_baseline_sha text;
  v_rows int;
  v_report jsonb;
begin
  select s.source_id,s.retrieved_at,s.source_sha256
    into v_source,v_candidate_at,v_source_sha
  from ff_private.ff_ingest_snapshots s
  join public.ff_sources src on src.id=s.source_id
  where s.id=p_candidate
    and src.name='Footbolno' and src.license_status='approved'
    and src.license_reference='https://footbolno.ru/otkrytye-dannye'
    and s.source_url='https://footbolno.ru/data/league/235-matches.csv'
    and s.license_url=src.license_reference;
  if v_source is null then
    raise exception 'M1 revision review: approved snapshot not found';
  end if;

  select s.id,s.retrieved_at,s.source_sha256
    into v_base,v_baseline_at,v_baseline_sha
  from ff_private.ff_ingest_snapshots s
  where s.source_id=v_source
    and exists(select 1 from ff_private.ff_published_fixture_links l
      where l.snapshot_id=s.id)
  order by s.retrieved_at desc,s.id desc limit 1;

  if v_base is null then
    raise exception 'M1 revision review: no verified published baseline';
  end if;
  if v_candidate_at < v_baseline_at then
    raise exception 'M1 revision review: candidate predates published baseline';
  end if;
  select count(*) into v_rows
    from ff_private.ff_ingest_matches where snapshot_id=p_candidate;
  if v_rows<>720
    or exists(select 1 from ff_private.ff_ingest_matches
      where snapshot_id=p_candidate group by season having count(*)<>240)
    or (select count(distinct season) from ff_private.ff_ingest_matches
      where snapshot_id=p_candidate)<>3
    or exists(select 1 from ff_private.ff_ingest_matches
      where snapshot_id=p_candidate and (
        quarantine_reason is not null or published_at is not null
        or status not in ('finished','scheduled')
        or kickoff_time_confirmed is distinct from (kickoff_at is not null)
        or (status='finished' and
          (home_goals is null or away_goals is null or kickoff_at is null))
        or (status='scheduled' and
          (home_goals is not null or away_goals is not null))
        or (season='2024/2025' and
          (dataset_role<>'train_baseline' or status<>'finished'))
        or (season='2025/2026' and
          (dataset_role<>'sealed_holdout' or status<>'finished'))
        or (season='2026/2027' and dataset_role<>'current')
      ))
    or exists(
      select 1 from (
        select season,home_source_id as team_id
          from ff_private.ff_ingest_matches where snapshot_id=p_candidate
        union all
        select season,away_source_id
          from ff_private.ff_ingest_matches where snapshot_id=p_candidate
      ) t group by season having count(distinct team_id)<>16
    )
  then
    raise exception 'M1 revision review: candidate quality gate failed';
  end if;

  -- Compare immutable snapshots by season + directed provider-team IDs,
  -- not mutable provider match IDs, text labels or approximate dates.
  with aligned as (
    select coalesce(n.season,o.season) as season,
      n.source_match_id is null as removed,
      o.source_match_id is null as added,
      n.source_match_id is distinct from o.source_match_id as source_id_diff,
      n.home_name is distinct from o.home_name
        or n.away_name is distinct from o.away_name as name_diff,
      n.dataset_role is distinct from o.dataset_role as role_diff,
      n.calendar_date_utc is distinct from o.calendar_date_utc as calendar_diff,
      n.kickoff_at is distinct from o.kickoff_at
        or n.kickoff_time_confirmed is distinct from o.kickoff_time_confirmed
        as kickoff_diff,
      n.status is distinct from o.status as status_diff,
      n.home_goals is distinct from o.home_goals
        or n.away_goals is distinct from o.away_goals as score_diff,
      n.kickoff_at is not null as new_kickoff_known,
      o.kickoff_at is not null as old_kickoff_known,
      n.status as new_status,
      o.status as old_status
    from (select * from ff_private.ff_ingest_matches
      where snapshot_id=p_candidate) n
    full join (select * from ff_private.ff_ingest_matches
      where snapshot_id=v_base) o
    on n.season=o.season and n.home_source_id=o.home_source_id
      and n.away_source_id=o.away_source_id
  ),
  counts as (
    select season,
      count(*) filter(where added)::int as added,
      count(*) filter(where removed)::int as removed,
      count(*) filter(where not added and not removed and
        (source_id_diff or name_diff or role_diff or calendar_diff
          or kickoff_diff or status_diff or score_diff))::int as modified,
      count(*) filter(where not added and not removed and
        not (source_id_diff or name_diff or role_diff or calendar_diff
          or kickoff_diff or status_diff or score_diff))::int as unchanged,
      count(*) filter(where not added and not removed and score_diff)::int as score_changes,
      count(*) filter(where not added and not removed and status_diff)::int as status_changes,
      count(*) filter(where not added and not removed and kickoff_diff)::int as kickoff_changes,
      count(*) filter(where not added and not removed and calendar_diff)::int as calendar_changes,
      count(*) filter(where not added and not removed and name_diff)::int as name_changes,
      count(*) filter(where not added and not removed and source_id_diff)::int as source_id_changes,
      count(*) filter(where not added and not removed
        and not old_kickoff_known and new_kickoff_known
        and old_status='scheduled' and new_status='scheduled')::int
        as newly_confirmed_times,
      count(*) filter(where not added and not removed
        and old_status='scheduled' and new_status='finished')::int
        as newly_finished,
      count(*) filter(where not added and not removed
        and old_status='finished' and new_status<>'finished')::int
        as finished_regressions
    from aligned group by season
  ), summary as (
    select coalesce(sum(added),0)::int as added,
      coalesce(sum(removed),0)::int as removed,
      coalesce(sum(modified),0)::int as modified,
      coalesce(sum(unchanged),0)::int as unchanged,
      coalesce(sum(score_changes),0)::int as score_changes,
      coalesce(sum(status_changes),0)::int as status_changes,
      coalesce(sum(kickoff_changes),0)::int as kickoff_changes,
      coalesce(sum(calendar_changes),0)::int as calendar_changes,
      coalesce(sum(name_changes),0)::int as name_changes,
      coalesce(sum(source_id_changes),0)::int as source_id_changes,
      coalesce(sum(newly_confirmed_times),0)::int as newly_confirmed_times,
      coalesce(sum(newly_finished),0)::int as newly_finished,
      coalesce(sum(finished_regressions),0)::int as finished_regressions,
      coalesce(sum(added+removed+modified) filter
        (where season in ('2024/2025','2025/2026')),0)::int
        as historical_train_or_holdout_changes
    from counts
  )
  select pg_catalog.jsonb_build_object(
    'baseline_snapshot_id',v_base,
    'candidate_snapshot_id',p_candidate,
    'baseline_sha256',v_baseline_sha,
    'candidate_sha256',v_source_sha,
    'snapshot_is_newer',v_candidate_at>v_baseline_at,
    'candidate_rows',v_rows,
    'change_counts',pg_catalog.to_jsonb(summary),
    'requires_review',(summary.added+summary.removed+summary.modified)>0,
    'auto_updates_enabled',false,
    'historical_as_of_verified',false,
    'seasons',(select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('season',season,'added',added,
        'removed',removed,'modified',modified,'unchanged',unchanged,
        'score_changes',score_changes,'status_changes',status_changes,
        'kickoff_changes',kickoff_changes,'calendar_changes',calendar_changes,
        'name_changes',name_changes,'source_id_changes',source_id_changes,
        'newly_confirmed_times',newly_confirmed_times,
        'newly_finished',newly_finished,'finished_regressions',finished_regressions)
      order by season) from counts)
  ) into v_report from summary;

  return v_report;
end;
$m1_review$;
revoke all on function ff_private.ff_preview_footbolno_revision(uuid)
  from public,anon,authenticated;
