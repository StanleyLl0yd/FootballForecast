-- M0 LIVE/SYNTHETIC check of immutable forecast archive DDL.
-- Production-safe: ONE SELECT over PostgreSQL system catalogs, NO mutations.
-- A failed invariant intentionally raises division-by-zero (CI fail-closed).
-- Does not prove row-level temporal guard behavior without controlled writes.
-- Body digests pin the precise baseline from the already-deployed M0
-- migration, not merely function names which could conceal altered behavior.
WITH expected_triggers(tablename,trigger_name,function_name,trigger_flags,source_md5) AS (
  VALUES
    ('ff_matches','ff_matches_integrity','ff_guard_match_update',19,'568e7b92ff282bb69ca651bf12a543fc'),
    ('ff_forecasts','ff_forecast_preinsert','ff_guard_forecast_insert',7,'8cc1cec128e3506c233051c9a5e5a1c0'),
    ('ff_forecasts','ff_forecast_immutable','ff_append_only_guard',27,'3bad8f28959577ea43e339d062576584'),
    ('ff_forecast_outcomes','ff_outcomes_preinsert','ff_guard_outcome_insert',7,'a7a92e116d140e0afc23b0782db608cc'),
    ('ff_forecast_outcomes','ff_outcomes_immutable','ff_append_only_guard',27,'3bad8f28959577ea43e339d062576584')
),
actual_triggers AS (
  SELECT c.relname AS tablename,t.tgname AS trigger_name,
    p.proname AS function_name,t.tgtype::integer AS trigger_flags,
    t.tgenabled,t.tgisinternal,p.prosecdef,md5(p.prosrc) AS source_md5,
    coalesce('search_path=""'=ANY(p.proconfig),false) AS empty_search_path
  FROM pg_trigger t
  JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_proc p ON p.oid=t.tgfoid
  WHERE n.nspname='public'
    AND c.relname IN ('ff_matches','ff_forecasts','ff_forecast_outcomes')
    AND NOT t.tgisinternal
),
trigger_integrity AS (
  SELECT count(*)::integer AS compared,
    count(*) FILTER (WHERE e.trigger_name IS NULL OR a.trigger_name IS NULL
      OR e.tablename IS DISTINCT FROM a.tablename
      OR e.function_name IS DISTINCT FROM a.function_name
      OR e.trigger_flags IS DISTINCT FROM a.trigger_flags
      OR e.source_md5 IS DISTINCT FROM a.source_md5
      OR a.tgenabled IS DISTINCT FROM 'O'
      OR a.prosecdef IS DISTINCT FROM false
      OR a.empty_search_path IS DISTINCT FROM true
    )::integer AS broken
  FROM expected_triggers e FULL OUTER JOIN actual_triggers a
   ON e.tablename=a.tablename AND e.trigger_name=a.trigger_name
),
expected_indexes(index_name) AS (
  VALUES ('ff_matches_kickoff_idx'),('ff_matches_season_id_idx'),
    ('ff_matches_home_id_idx'),('ff_matches_away_id_idx')
),
index_integrity AS (
  SELECT count(*)::integer AS compared,
    count(*) FILTER (WHERE i.index_name IS NULL OR NOT i.indisvalid
      OR NOT i.indisready)::integer AS broken
  FROM expected_indexes e LEFT JOIN LATERAL (
    SELECT ic.relname AS index_name,idx.indisvalid,idx.indisready
    FROM pg_index idx
    JOIN pg_class tc ON tc.oid=idx.indrelid
    JOIN pg_namespace ns ON ns.oid=tc.relnamespace
    JOIN pg_class ic ON ic.oid=idx.indexrelid
    WHERE ns.nspname='public' AND tc.relname='ff_matches'
      AND ic.relname=e.index_name
  ) i ON true
),
private_helper AS (
  SELECT count(*)::integer AS total_helpers,
    count(*) FILTER (WHERE p.prosecdef
      AND coalesce('search_path=""'=ANY(p.proconfig),false)
      AND md5(p.prosrc)='46afc5c58840cad825e4d57f116d8515'
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')
    )::integer AS safe_functions
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='ff_private' AND p.proname='ff_is_authorized'
)
SELECT 1 / CASE WHEN t.compared=5 AND t.broken=0
  AND i.compared=4 AND i.broken=0 AND p.total_helpers=1 AND p.safe_functions=1
THEN 1 ELSE 0 END AS ff_immutable_ledger_catalog_pass,
  t.compared AS triggers_checked,t.broken AS trigger_errors,
  i.compared AS indexes_checked,i.broken AS index_errors,
  p.safe_functions AS private_authorization_helpers_checked
FROM trigger_integrity t CROSS JOIN index_integrity i CROSS JOIN private_helper p;
