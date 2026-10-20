-- M0 real PostgreSQL catalog attestation. Safe on production: SELECT ONLY.
-- Proves the EXACT nine-table RLS/grant/anon policy configuration; this is
-- NOT a real HTTP/PostgREST rejection probe or disaster-recovery backup.
-- A failed invariant triggers division-by-zero to make CI fail closed.
WITH expected (relname, should_read) AS (
  VALUES
    ('ff_access_grants', false),
    ('ff_competitions', true),
    ('ff_forecast_outcomes', true),
    ('ff_forecasts', true),
    ('ff_matches', true),
    ('ff_seasons', true),
    ('ff_source_records', false),
    ('ff_sources', false),
    ('ff_teams', true)
),
actual AS (
  SELECT c.oid, c.relname, c.relrowsecurity,
    has_table_privilege('anon',c.oid,'SELECT') AS can_read,
    has_table_privilege('anon',c.oid,'INSERT') AS can_insert,
    has_table_privilege('anon',c.oid,'UPDATE') AS can_update,
    has_table_privilege('anon',c.oid,'DELETE') AS can_delete,
    has_table_privilege('anon',c.oid,'TRUNCATE') AS can_truncate,
    has_table_privilege('anon',c.oid,'REFERENCES') AS can_reference,
    has_table_privilege('anon',c.oid,'TRIGGER') AS can_trigger,
    (SELECT count(*)::integer FROM pg_policies p
      WHERE p.schemaname='public' AND p.tablename=c.relname
      AND p.cmd='SELECT' AND (p.roles::text[] && ARRAY['anon','public'])
    ) AS public_select_policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND left(c.relname,3)='ff_'
    AND c.relkind IN ('r','p')
),
table_checks AS (
  SELECT count(*)::integer AS compared,
    count(*) FILTER (
      WHERE e.relname IS NULL OR a.relname IS NULL
        OR a.relrowsecurity IS DISTINCT FROM true
        OR a.can_read IS DISTINCT FROM e.should_read
        OR a.can_insert OR a.can_update OR a.can_delete
        OR a.can_truncate OR a.can_reference OR a.can_trigger
        OR a.public_select_policies IS DISTINCT FROM
           CASE WHEN e.should_read THEN 1 ELSE 0 END
    )::integer AS failed
  FROM expected e FULL OUTER JOIN actual a USING (relname)
),
policy_checks AS (
  SELECT count(*)::integer AS anon_write_policies
  FROM pg_policies p WHERE p.schemaname='public'
    AND left(p.tablename,3)='ff_'
    AND p.cmd IN ('ALL','INSERT','UPDATE','DELETE')
    AND (p.roles::text[] && ARRAY['anon','public'])
),
function_checks AS (
  SELECT count(*)::integer AS anon_security_definer_functions
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND left(p.proname,3)='ff_'
    AND p.prosecdef
    AND has_function_privilege('anon',p.oid,'EXECUTE')
),
schema_checks AS (
  SELECT
    has_schema_privilege('anon','public','USAGE') AS has_public_usage,
    has_schema_privilege('anon','public','CREATE') AS can_create_in_public,
    has_schema_privilege('anon','ff_private','USAGE') AS can_use_private_schema
)
SELECT
  1 / CASE WHEN t.compared=9 AND t.failed=0
    AND p.anon_write_policies=0
    AND f.anon_security_definer_functions=0
    AND s.has_public_usage
    AND NOT s.can_create_in_public
    AND NOT s.can_use_private_schema
  THEN 1 ELSE 0 END AS ff_live_anon_catalog_attestation_pass,
  t.compared AS verified_table_count,
  t.failed AS table_mismatches,
  p.anon_write_policies AS writable_anon_policy_count,
  f.anon_security_definer_functions AS executable_security_definer_count
FROM table_checks t CROSS JOIN policy_checks p
CROSS JOIN function_checks f CROSS JOIN schema_checks s;
