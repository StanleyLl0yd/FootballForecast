-- Execute after the pre-existing private/RLS tests on the disposable fixture.
\echo 'Anonymous public READ only: safe catalog tables exposed'
set role anon;
select 1 / case when (select count(*) from public.ff_teams)=2 then 1 else 0 end as public_teams;
select 1 / case when (select count(*) from public.ff_matches)=2 then 1 else 0 end as public_matches;
select 1 / case when (select count(*) from public.ff_forecasts)>=1 then 1 else 0 end as public_forecasts;
reset role;
select 1 / case when
 has_table_privilege('anon','public.ff_matches','SELECT')
 and has_table_privilege('anon','public.ff_forecasts','SELECT')
 and not has_table_privilege('anon','public.ff_access_grants','SELECT')
 and not has_table_privilege('anon','public.ff_source_records','SELECT')
 and not has_table_privilege('anon','public.ff_sources','SELECT')
 and not has_table_privilege('anon','public.ff_matches','INSERT')
 and not has_table_privilege('anon','public.ff_matches','UPDATE')
 and not has_table_privilege('anon','public.ff_forecasts','DELETE')
 and not has_schema_privilege('anon','ff_private','USAGE')
 then 1 else 0 end as public_least_privilege;
select 1 / case when (select count(*) from pg_policies
 where schemaname='public' and policyname like 'ff_%_public_read')=6
 then 1 else 0 end as exactly_six_public_read_policies;
\echo 'Public read contract passed'
