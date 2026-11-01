-- After original + exact replay + equivalent raw SHA + truly changed raw SHA.
\echo 'M1 semantic equivalence avoids 720 redundant private match copies'
select 1 / case when
 (select count(*) from ff_private.ff_ingest_snapshots)=2
 and (select count(*) from ff_private.ff_ingest_matches)=1440
 and (select count(*) from ff_private.ff_source_byte_observations)=3
 and (select count(*) from public.ff_matches)=482
 and (select count(*) from ff_private.ff_published_fixture_links)=480
then 1 else 0 end as compact_observation_counts;
do $m1$
declare
  base uuid;
  same uuid;
  changed uuid;
  review jsonb;
begin
  select ff_private.ff_resolve_footbolno_source_sha(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      'synthetic-source-bytes','UTF8')),'hex')) into strict base;
  select ff_private.ff_resolve_footbolno_source_sha(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      'synthetic-source-bytes-v2','UTF8')),'hex')) into strict same;
  select ff_private.ff_resolve_footbolno_source_sha(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      'synthetic-source-bytes-v3','UTF8')),'hex')) into strict changed;
  if base is null or same is distinct from base or changed=base then
    raise exception 'M1 compact raw bytes did not resolve to correct canonical snapshot';
  end if;
  review:=ff_private.ff_preview_footbolno_revision(same);
  if (review->>'requires_review')::boolean
    or (review->'change_counts'->>'unchanged')::int<>720 then
    raise exception 'M1 equal semantic raw observation invented a match revision';
  end if;
  review:=ff_private.ff_preview_footbolno_revision(changed);
  if not (review->>'requires_review')::boolean
    or (review->'change_counts'->>'score_changes')::int<>1
    or (review->'change_counts'->>'historical_train_or_holdout_changes')::int<>1 then
    raise exception 'M1 changed fixture was improperly deduplicated';
  end if;
end;
$m1$;
\echo 'PASS: equivalent byte source retained as compact immutable observation'
