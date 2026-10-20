-- M0: exact exposed public schema surface. Catalog-only, production-safe.
-- No DDL/DML; reject *any* newly exposed relation or RPC-capable routine.
-- Complements 0005 grants/RLS and 0006 forecast-integrity fingerprints.
WITH expected_relations(relname) AS (
 VALUES ('ff_access_grants'),('ff_competitions'),('ff_forecast_outcomes'),
 ('ff_forecasts'),('ff_matches'),('ff_seasons'),('ff_source_records'),
 ('ff_sources'),('ff_teams')
), public_relations AS (
 SELECT c.relname, c.relkind::text AS relkind
 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind IN ('r','p','v','m','f','S')
), relation_integrity AS (
 SELECT count(*)::integer AS compared,
   count(*) FILTER (WHERE e.relname IS NULL OR a.relname IS NULL
     OR a.relkind IS DISTINCT FROM 'r')::integer AS broken
 FROM expected_relations e FULL OUTER JOIN public_relations a USING(relname)
), expected_functions(proname) AS (
 VALUES ('ff_append_only_guard'),('ff_guard_forecast_insert'),
        ('ff_guard_match_update'),('ff_guard_outcome_insert')
), public_functions AS (
 SELECT p.proname, p.prokind::text AS prokind,
   p.prorettype AS return_oid, p.prosecdef,
   oidvectortypes(p.proargtypes) AS arguments
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
), function_integrity AS (
 SELECT count(*)::integer AS compared,
   count(*) FILTER (WHERE e.proname IS NULL OR a.proname IS NULL
     OR a.prokind IS DISTINCT FROM 'f'
     OR a.return_oid IS DISTINCT FROM 'pg_catalog.trigger'::regtype::oid
     OR a.prosecdef IS DISTINCT FROM false
     OR a.arguments IS DISTINCT FROM '')::integer AS broken
 FROM expected_functions e FULL OUTER JOIN public_functions a USING(proname)
)
SELECT 1 / CASE WHEN r.compared=9 AND r.broken=0
  AND f.compared=4 AND f.broken=0 THEN 1 ELSE 0 END
  AS ff_public_surface_attestation_pass,
  r.compared AS relation_count, r.broken AS relation_mismatches,
  f.compared AS function_count, f.broken AS function_mismatches
FROM relation_integrity r CROSS JOIN function_integrity f;
