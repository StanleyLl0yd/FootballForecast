-- M1 narrow current-season refresh is explicitly privileged and all events are private.
\echo 'M1 safe current refresh access and immutability'
select 1 / case when
  to_regprocedure('public.ff_apply_safe_current_refresh(uuid)') is null
  and to_regprocedure('ff_private.ff_apply_safe_current_refresh(uuid)') is not null
  and not has_function_privilege('anon',
    'ff_private.ff_apply_safe_current_refresh(uuid)','EXECUTE')
  and not has_function_privilege('authenticated',
    'ff_private.ff_apply_safe_current_refresh(uuid)','EXECUTE')
  and not has_table_privilege('anon','ff_private.ff_current_refresh_events','SELECT')
  and not has_table_privilege('authenticated','ff_private.ff_current_refresh_events','SELECT')
  and (select relrowsecurity from pg_class
    where oid='ff_private.ff_current_refresh_events'::regclass)
then 1 else 0 end as private_safe_refresh_denied_to_browsers;
select 1 / case when exists(
  select 1 from pg_proc
  where oid='ff_private.ff_apply_safe_current_refresh(uuid)'::regprocedure
    and not prosecdef
) then 1 else 0 end as safe_refresh_security_invoker;
select 1 / case when (select count(*) from ff_private.ff_current_refresh_events)=0
then 1 else 0 end as no_automatic_refresh;
\echo 'PASS: safe current refresh is dormant and private'
