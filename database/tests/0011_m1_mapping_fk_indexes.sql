-- M1 mapping FK index coverage, no privilege or row changes.
\echo 'M1 mapping foreign-key index contract'
select 1 / case when (
  select count(*) from pg_indexes where schemaname='ff_private'
    and (indexname='ff_provider_team_links_team_id_idx'
      and indexdef like '%(team_id)%' or
         indexname='ff_published_fixture_links_match_id_idx'
      and indexdef like '%(match_id)%')
)=2 then 1 else 0 end as private_mapping_fk_indexes_present;
select 1 / case when (
  select count(*) from pg_class
   where oid in ('ff_private.ff_provider_team_links'::regclass,
                 'ff_private.ff_published_fixture_links'::regclass)
     and relrowsecurity
)=2 then 1 else 0 end as private_mappings_still_rls_enabled;
select 1 / case when
  not has_table_privilege('anon','ff_private.ff_provider_team_links','SELECT')
  and not has_table_privilege('authenticated','ff_private.ff_published_fixture_links','SELECT')
then 1 else 0 end as private_mappings_still_inaccessible;
\echo 'PASS: M1 private foreign-key indexes'
