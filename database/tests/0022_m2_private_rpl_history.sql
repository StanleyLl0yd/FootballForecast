-- Entirely synthetic PostgreSQL 17 private-history constraints.
\echo 'M2 private RPL history snapshot and RLS tests'
select 1 / case when (
  select c.relrowsecurity and c.relforcerowsecurity from pg_class c
  where c.oid='ff_private.ff_rpl_history_snapshots'::regclass
) and (
  select c.relrowsecurity and c.relforcerowsecurity from pg_class c
  where c.oid='ff_private.ff_rpl_history_matches'::regclass
) and not has_table_privilege('anon','ff_private.ff_rpl_history_snapshots','SELECT')
  and not has_table_privilege('authenticated','ff_private.ff_rpl_history_matches','SELECT')
  and not has_table_privilege('service_role','ff_private.ff_rpl_history_matches','SELECT')
  and not has_table_privilege('service_role','ff_private.ff_rpl_history_snapshots','INSERT')
  and not has_table_privilege('anon','ff_private.ff_rpl_history_matches','INSERT')
then 1 else 0 end as private_denied_and_force_rls;

begin;
insert into ff_private.ff_rpl_history_snapshots (
 season,source_responses_sha256,normalized_rows_sha256,
 retrieved_at,github_run_id,source_response_pages,fixture_count
) values ('2018/19',repeat('a',64),repeat('b',64),
  '2026-11-03T15:19:44Z',123456789,17,240);
insert into ff_private.ff_rpl_history_matches (
 snapshot_id,source_match_id,home_team_id,away_team_id,
 kickoff_at,home_goals,away_goals
) select s.id,format('synthetic_%s_%s',home,away),
  format('synthetic_team_%s',home),format('synthetic_team_%s',away),
  '2018-09-20T16:00:00Z'::timestamptz,
  (home % 4)::smallint,(away % 3)::smallint
from ff_private.ff_rpl_history_snapshots s
cross join generate_series(1,16) home
cross join generate_series(1,16) away
where home<>away and s.season='2018/19' and s.normalized_rows_sha256=repeat('b',64);
-- Force the deferred 240-row/16-club validation while rows still exist.
set constraints ff_rpl_history_snapshot_complete immediate;
select 1 / case when (
  select count(*) from ff_private.ff_rpl_history_matches
)=240 and (
  select count(*) from ff_private.ff_rpl_history_snapshots
)=1 then 1 else 0 end as full_private_synthetic_dataset;

do $m2$
begin
  begin
    update ff_private.ff_rpl_history_snapshots
      set model_training_approved=true;
    raise exception 'Unexpected private snapshot mutation';
  exception when others then
    if SQLERRM <> 'Source snapshot history is append-only' then raise; end if;
  end;
  begin
    delete from ff_private.ff_rpl_history_matches;
    raise exception 'Unexpected private match deletion';
  exception when others then
    if SQLERRM <> 'Source snapshot history is append-only' then raise; end if;
  end;
end;
$m2$;
rollback;
select 1 / case when (select count(*) from ff_private.ff_rpl_history_snapshots)=0
  and (select count(*) from ff_private.ff_rpl_history_matches)=0
then 1 else 0 end as synthetic_rollback_verified;
\echo 'PASS: private historical research tables'
