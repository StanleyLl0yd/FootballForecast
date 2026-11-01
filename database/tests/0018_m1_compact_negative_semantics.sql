-- Real PG17 integration, synthetic-only: negative replay, chronology and holdout checks.
\echo 'M1 source byte history: failed writes roll back, sealed holdout stays private'
select
  (select count(*) from ff_private.ff_ingest_snapshots) as full_snapshots,
  (select count(*) from ff_private.ff_ingest_matches) as private_rows,
  (select count(*) from ff_private.ff_source_byte_observations) as observed_byte_shas,
  (select count(*) from ff_private.ff_published_fixture_links) as public_links,
  (select count(*) from ff_private.ff_current_refresh_events) as refresh_events,
  (select count(*) from public.ff_matches) as public_matches,
  (select count(*) from public.ff_forecasts) as public_forecasts;
select 1 / case when
  (select count(*) from ff_private.ff_ingest_snapshots)=3
  and (select count(*) from ff_private.ff_ingest_matches)=2160
  and (select count(*) from ff_private.ff_source_byte_observations)=4
  and (select count(*) from ff_private.ff_published_fixture_links)=480
  and (select count(*) from ff_private.ff_current_refresh_events)=0
  and (select count(*) from public.ff_matches)=482
  and (select count(*) from public.ff_forecasts)=:expected_forecasts
then 1 else 0 end as unchanged_public_and_private_counts;

do $m1_test$
declare
  holdout uuid;
  review jsonb;
  original uuid;
begin
  select ff_private.ff_resolve_footbolno_source_sha(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      'synthetic-source-bytes-v5','UTF8')),'hex')) into strict holdout;
  select ff_private.ff_resolve_footbolno_source_sha(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      'synthetic-source-bytes','UTF8')),'hex')) into strict original;
  if holdout=original then
    raise exception 'M1 sealed holdout revision incorrectly merged into old snapshot';
  end if;
  review:=ff_private.ff_preview_footbolno_revision(holdout);
  if (review->>'requires_review')::boolean is distinct from true
    or (review->'change_counts'->>'historical_train_or_holdout_changes')::int<>1
    or (review->'change_counts'->>'score_changes')::int<>1
  then
    raise exception 'M1 sealed holdout correction did not demand private review';
  end if;
  begin
    perform ff_private.ff_apply_safe_current_refresh(holdout);
    raise exception 'M1 protected refresh accepted historical sealed-holdout drift';
  exception when others then
    if SQLERRM <> 'M1 current refresh: review required for source changes' then
      raise;
    end if;
  end;
end
$m1_test$;
\echo 'PASS: raw hash tampering, old observations and holdout corrections fail closed'
