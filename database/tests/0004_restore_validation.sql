-- Independent clean-database assertions after pg_dump/pg_restore of synthetic CI data.
\echo 'Verifying restored M0 schema, non-personal fixtures and immutable ledger'
select 1 / case when (select count(*) from auth.users)=2
  and (select count(*) from public.ff_access_grants)=1
  and (select count(*) from public.ff_competitions)=1
  and (select count(*) from public.ff_seasons)=1
  and (select count(*) from public.ff_teams)=2
  and (select count(*) from public.ff_matches)=2
  and (select count(*) from public.ff_forecasts)=2
  and (select count(*) from public.ff_forecast_outcomes)=1
then 1 else 0 end as fixture_rows_recovered;

select 1 / case when (select count(*) from pg_tables
 where schemaname='public' and tablename like 'ff_%' and rowsecurity)=9
 and (select count(*) from pg_policies
 where schemaname='public' and policyname like 'ff_%_public_read')=6
then 1 else 0 end as original_rls_restored;

select 1 / case when (select count(*) from pg_trigger
 where tgrelid in ('public.ff_forecasts'::regclass,'public.ff_forecast_outcomes'::regclass,
 'public.ff_matches'::regclass) and not tgisinternal
 and tgname in ('ff_forecast_preinsert','ff_forecast_immutable',
 'ff_outcomes_preinsert','ff_outcomes_immutable','ff_matches_integrity'))=5
then 1 else 0 end as archive_integrity_triggers_recovered;

select 1 / case when (select count(*) from pg_indexes
 where schemaname='public' and tablename='ff_matches'
 and indexname in ('ff_matches_kickoff_idx','ff_matches_season_id_idx',
 'ff_matches_home_id_idx','ff_matches_away_id_idx'))=4
then 1 else 0 end as needed_match_indexes_recovered;

select 1 / case when
 to_regprocedure('ff_private.ff_is_authorized()') is not null
 and has_table_privilege('anon','public.ff_matches','SELECT')
 and not has_table_privilege('anon','public.ff_matches','INSERT')
 and not has_table_privilege('anon','public.ff_sources','SELECT')
 and not has_table_privilege('anon','public.ff_access_grants','SELECT')
 and not has_schema_privilege('anon','ff_private','USAGE')
then 1 else 0 end as least_privilege_restored;

set role anon;
select 1 / case when (select count(*) from public.ff_matches)=2
 and (select count(*) from public.ff_forecasts)=2
 and (select count(*) from public.ff_forecast_outcomes)=1
then 1 else 0 end as anonymous_reads_survive_restore;
reset role;

do $$
begin
  begin
    update public.ff_forecasts set model_version='tampered'
    where id='14000000-0000-0000-0000-000000000002';
    raise exception 'Restore lost append-only guard';
  exception when sqlstate 'P0001' then
    if position('Append-only' in sqlerrm)=0 then
      raise exception 'Unexpected restored guard: %',sqlerrm;
    end if;
  end;
end;
$$;
select 1 / case when
 (select model_version from public.ff_forecasts
  where id='14000000-0000-0000-0000-000000000002')='historical-test-only'
then 1 else 0 end as restored_history_unchanged;

\echo 'PASS: backup round trip preserves fixture data, RLS, privileges, triggers, indexes'
