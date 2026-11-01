-- Synthetic PG17: changed current fixture passes through compact-ledger SHA lookup
-- without rewriting historical train/holdout evidence or forecasts.
\echo 'M1 canonical ledger full lifecycle: scheduled date-only -> exact time -> final'
do $m1_current$
declare
  known uuid;
  final uuid;
  initial jsonb;
  applied jsonb;
  repeated jsonb;
begin
  select ff_private.ff_resolve_footbolno_source_sha(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      'synthetic-source-bytes-v6','UTF8')),'hex')) into strict known;
  initial:=ff_private.ff_apply_safe_current_refresh(known);
  if (initial->>'newly_confirmed_scheduled')::int<>1
    or (initial->>'scheduled_to_finished')::int<>0
    or (initial->>'public_links')::int<>481
    or (initial->>'already_published')::boolean then
    raise exception 'M1 exact kickoff transition failed compact-source review';
  end if;
  select ff_private.ff_resolve_footbolno_source_sha(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
      'synthetic-source-bytes-v7','UTF8')),'hex')) into strict final;
  applied:=ff_private.ff_apply_safe_current_refresh(final);
  if (applied->>'newly_confirmed_scheduled')::int<>0
    or (applied->>'scheduled_to_finished')::int<>1
    or (applied->>'public_links')::int<>481
    or (applied->>'already_published')::boolean then
    raise exception 'M1 scheduled-to-finished transition failed compact-source review';
  end if;
  repeated:=ff_private.ff_apply_safe_current_refresh(final);
  if (repeated->>'already_published')::boolean is distinct from true
    or (repeated->>'scheduled_to_finished')::int<>0 then
    raise exception 'M1 canonical final-result replay was not idempotent';
  end if;
end
$m1_current$;

select 1 / case when
  (select count(*) from ff_private.ff_ingest_snapshots)=5
  and (select count(*) from ff_private.ff_ingest_matches)=3600
  and (select count(*) from ff_private.ff_source_byte_observations)=6
  and (select count(*) from ff_private.ff_published_fixture_links)=1442
  and (select count(*) from ff_private.ff_current_refresh_events)=1
  and (select count(*) from public.ff_matches)=483
  and (select count(*) from public.ff_matches
       where status='finished' and home_goals=1 and away_goals=0)=1
  and (select count(*) from public.ff_forecasts)=:expected_forecasts
  and (select count(*) from ff_private.ff_current_refresh_events e
       join public.ff_matches m on m.id=e.match_id
       where m.status='finished'
         and m.home_goals=e.new_home_goals and m.away_goals=e.new_away_goals)=1
then 1 else 0 end as verified_immutable_compact_current_refresh;
\echo 'PASS: current match transitions recorded once; holdout/public forecasts unmodified'
