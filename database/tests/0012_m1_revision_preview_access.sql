-- M1 private read-only revision preview: no browser role or public API exposure.
\echo 'M1 revision preview privacy and read-only contract'
select 1 / case when
  to_regprocedure('public.ff_preview_footbolno_revision(uuid)') is null
  and to_regprocedure('ff_private.ff_preview_footbolno_revision(uuid)') is not null
  and not has_function_privilege('anon',
    'ff_private.ff_preview_footbolno_revision(uuid)','EXECUTE')
  and not has_function_privilege('authenticated',
    'ff_private.ff_preview_footbolno_revision(uuid)','EXECUTE')
then 1 else 0 end as revision_preview_private_only;
select 1 / case when exists(
  select 1 from pg_proc
  where oid='ff_private.ff_preview_footbolno_revision(uuid)'::regprocedure
    and not prosecdef and provolatile='s'
) then 1 else 0 end as stable_security_invoker_revision_preview;
\echo 'PASS: revision preview is private and query-only'
