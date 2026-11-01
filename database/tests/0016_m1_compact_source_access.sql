-- M1 compact observations are append-only and anonymous roles cannot resolve them.
\echo 'M1 compact raw SHA observation access controls'
select 1 / case when
  (select relrowsecurity from pg_class
   where oid='ff_private.ff_source_byte_observations'::regclass)
  and not has_table_privilege('anon','ff_private.ff_source_byte_observations','SELECT')
  and not has_table_privilege('authenticated','ff_private.ff_source_byte_observations','SELECT')
  and not has_function_privilege('anon',
    'ff_private.ff_resolve_footbolno_source_sha(text)','EXECUTE')
  and not has_function_privilege('authenticated',
    'ff_private.ff_resolve_footbolno_source_sha(text)','EXECUTE')
  and (select prosecdef=false and provolatile='s' from pg_proc
    where oid='ff_private.ff_resolve_footbolno_source_sha(text)'::regprocedure)
then 1 else 0 end as private_equivalence_controls;
\echo 'PASS: compact source observations stay private'
