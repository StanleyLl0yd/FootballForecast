-- Synthetic-only catalog/authorization checks for M1 guarded promotion.
\echo 'M1 canonical promotion security invariants'
select 1 / case when count(*)=2 then 1 else 0 end as private_mapping_tables_rls
from pg_class where oid in (
  'ff_private.ff_provider_team_links'::regclass,
  'ff_private.ff_published_fixture_links'::regclass) and relrowsecurity;
select 1 / case when
  not has_table_privilege('anon','ff_private.ff_provider_team_links','SELECT')
  and not has_table_privilege('authenticated','ff_private.ff_provider_team_links','SELECT')
  and not has_table_privilege('anon','ff_private.ff_published_fixture_links','SELECT')
  and not has_table_privilege('authenticated','ff_private.ff_published_fixture_links','SELECT')
  and not has_function_privilege('anon','ff_private.ff_promote_footbolno_snapshot(uuid)','EXECUTE')
  and not has_function_privilege('authenticated','ff_private.ff_promote_footbolno_snapshot(uuid)','EXECUTE')
then 1 else 0 end as private_promotion_unavailable_from_api;
select 1 / case when exists(
  select 1 from pg_indexes
  where schemaname='public' and tablename='ff_matches'
    and indexname='ff_matches_unique_directed_fixture'
    and indexdef like 'CREATE UNIQUE INDEX%'
) then 1 else 0 end as fixture_identity_is_unique;
select 1 / case when (select count(*) from ff_private.ff_published_fixture_links)=0
    and (select count(*) from ff_private.ff_provider_team_links)=0
then 1 else 0 end as no_automatic_promotion;
\echo 'PASS: guarded promotion objects remain private and dormant'
