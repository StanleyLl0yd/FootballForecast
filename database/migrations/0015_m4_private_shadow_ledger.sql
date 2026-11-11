-- M4-A4 private forward-only shadow candidate/model/capture/forecast ledger.
-- This DDL does not create ANY public forecast, API grant or scheduled job.
-- Server-controlled timestamps prevent backfilled "before kickoff" records.
-- Real source independence and authentically signed capture remain A5 gates.
create table ff_private.ff_m4_candidate_models (
  id uuid primary key default gen_random_uuid(),
  model_version text not null check (
    model_version = 'm4-team-poisson-shrink12-shadow-v1'),
  training_scope text not null check (
    training_scope = '2018/19-2024/25-development-only'),
  training_matches integer not null check (training_matches = 1673),
  distinct_clubs integer not null check (distinct_clubs = 26),
  source_manifest_sha256 text not null check (
    source_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  eligible_rows_sha256 text not null check (
    eligible_rows_sha256 ~ '^[a-f0-9]{64}$'),
  model_sha256 text not null unique check (model_sha256 ~ '^[a-f0-9]{64}$'),
  model_bytes bytea not null check (octet_length(model_bytes) between 1 and 32768),
  code_sha text not null check (code_sha ~ '^[a-f0-9]{40}$'),
  github_run_id bigint not null unique check (github_run_id > 0),
  model_state text not null default 'SHADOW_CANDIDATE_UNAPPROVED'
    check (model_state = 'SHADOW_CANDIDATE_UNAPPROVED'),
  production_approved boolean not null default false
    check (production_approved = false),
  public_release_allowed boolean not null default false
    check (public_release_allowed = false),
  holdout_2025_26_read boolean not null default false
    check (holdout_2025_26_read = false),
  created_at timestamptz not null default clock_timestamp(),
  check (model_sha256 = encode(sha256(model_bytes),'hex')),
  unique (source_manifest_sha256, eligible_rows_sha256, model_sha256)
);

-- Future source and independently corroborated kickoff observation.
-- The insertion clock is OVERRIDDEN by PostgreSQL, not trusted from caller.
-- Real receipt-signature verification must occur in the protected A5 runner.
create table ff_private.ff_m4_future_captures (
  id uuid primary key default gen_random_uuid(),
  fixture_key text not null check (
    fixture_key ~ '^rpl-[a-z0-9][a-z0-9-]{0,94}$'),
  competition text not null check (competition = 'RPL'),
  season text not null check (season = '2026/27'),
  home_club_key text not null check (
    home_club_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  away_club_key text not null check (
    away_club_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  kickoff_at timestamptz not null,
  status text not null check (status = 'scheduled'),
  revision_kind text not null check (revision_kind = 'none'),
  source_revision_sha256 text not null check (
    source_revision_sha256 ~ '^[a-f0-9]{64}$'),
  kickoff_evidence_sha256 text not null check (
    kickoff_evidence_sha256 ~ '^[a-f0-9]{64}$'),
  team_mapping_sha256 text not null check (
    team_mapping_sha256 ~ '^[a-f0-9]{64}$'),
  source_issuer text not null check (
    source_issuer ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  kickoff_issuer text not null check (
    kickoff_issuer ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  source_mac_sha256 text not null check (
    source_mac_sha256 ~ '^[a-f0-9]{64}$'),
  kickoff_mac_sha256 text not null check (
    kickoff_mac_sha256 ~ '^[a-f0-9]{64}$'),
  source_observed_at timestamptz not null,
  kickoff_observed_at timestamptz not null,
  captured_at timestamptz not null default clock_timestamp(),
  publication_allowed boolean not null default false
    check (publication_allowed = false),
  holdout_2025_26_read boolean not null default false
    check (holdout_2025_26_read = false),
  check (home_club_key <> away_club_key),
  check (source_issuer <> kickoff_issuer),
  check (source_revision_sha256 <> kickoff_evidence_sha256),
  check (source_revision_sha256 <> team_mapping_sha256),
  check (kickoff_evidence_sha256 <> team_mapping_sha256),
  unique (fixture_key, source_revision_sha256, kickoff_evidence_sha256)
);
create index ff_m4_capture_fixture_lookup_idx
  on ff_private.ff_m4_future_captures(fixture_key, captured_at desc);

create table ff_private.ff_m4_shadow_entries (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references ff_private.ff_m4_future_captures(id),
  model_id uuid not null references ff_private.ff_m4_candidate_models(id),
  fixture_key text not null,
  revision integer not null check (revision between 1 and 100),
  previous_entry_id uuid references ff_private.ff_m4_shadow_entries(id),
  idempotency_sha256 text not null unique
    check (idempotency_sha256 ~ '^[a-f0-9]{64}$'),
  entry_kind text not null check (entry_kind in ('FORECAST','ABSTAIN')),
  abstention_reason text check (
    abstention_reason is null or
    abstention_reason ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  home_win double precision check (home_win between 0 and 1),
  draw double precision check (draw between 0 and 1),
  away_win double precision check (away_win between 0 and 1),
  expected_home double precision check (expected_home between 0 and 6),
  expected_away double precision check (expected_away between 0 and 6),
  prediction_sha256 text check (prediction_sha256 ~ '^[a-f0-9]{64}$'),
  committed_at timestamptz not null default clock_timestamp(),
  entry_state text not null default 'PRIVATE_SHADOW_UNAPPROVED'
    check (entry_state = 'PRIVATE_SHADOW_UNAPPROVED'),
  publication_allowed boolean not null default false
    check (publication_allowed = false),
  holdout_2025_26_read boolean not null default false
    check (holdout_2025_26_read = false),
  unique (fixture_key, model_id, revision),
  check (
    (entry_kind='FORECAST' and abstention_reason is null
      and home_win is not null and draw is not null and away_win is not null
      and expected_home is not null and expected_away is not null
      and prediction_sha256 is not null
      and abs(home_win+draw+away_win-1.0)<0.000000001)
    or
    (entry_kind='ABSTAIN' and abstention_reason is not null
      and home_win is null and draw is null and away_win is null
      and expected_home is null and expected_away is null
      and prediction_sha256 is null)
  )
);
create index ff_m4_entries_capture_idx
  on ff_private.ff_m4_shadow_entries(capture_id, committed_at desc);

create function ff_private.ff_m4_model_insert_guard()
returns trigger language plpgsql set search_path = '' as $m4$
begin
  new.created_at := clock_timestamp();
  return new;
end;
$m4$;

create function ff_private.ff_m4_capture_insert_guard()
returns trigger language plpgsql set search_path = '' as $m4$
declare v_now timestamptz;
begin
  v_now := clock_timestamp();
  new.captured_at := v_now; -- Cannot supply a forged earlier server time.
  if new.kickoff_at < '2026-07-01T00:00:00Z'::timestamptz
     or new.kickoff_at >= '2027-07-01T00:00:00Z'::timestamptz
     or new.source_observed_at <= '2026-11-11T11:04:56Z'::timestamptz
     or new.kickoff_observed_at <= '2026-11-11T11:04:56Z'::timestamptz
     or new.source_observed_at > v_now
     or new.kickoff_observed_at > v_now
     or v_now > new.source_observed_at + interval '2 hours'
     or v_now > new.kickoff_observed_at + interval '2 hours'
     or v_now + interval '15 minutes' > new.kickoff_at then
    raise exception 'M4 capture requires fresh independently signed future sources';
  end if;
  return new;
end;
$m4$;

create function ff_private.ff_m4_entry_insert_guard()
returns trigger language plpgsql set search_path = '' as $m4$
declare
  v_key text;
  v_kickoff timestamptz;
  v_capture timestamptz;
  v_prev record;
begin
  -- Lock capture to serialize writes sharing the same received evidence.
  select fixture_key,kickoff_at,captured_at
    into v_key,v_kickoff,v_capture
  from ff_private.ff_m4_future_captures
  where id=new.capture_id for update;
  if not found or v_key is distinct from new.fixture_key then
    raise exception 'M4 shadow fixture or capture identity mismatch';
  end if;
  if not exists (select 1 from ff_private.ff_m4_candidate_models
                 where id=new.model_id) then
    raise exception 'M4 shadow requires a private locked candidate model';
  end if;
  new.committed_at := clock_timestamp();
  if v_capture > new.committed_at
     or new.committed_at + interval '15 minutes' > v_kickoff then
    raise exception 'M4 forecast must be committed with real pre-kickoff lead';
  end if;
  if new.revision=1 then
    if new.previous_entry_id is not null then
      raise exception 'M4 initial revision cannot reference an earlier entry';
    end if;
  else
    if new.previous_entry_id is null then
      raise exception 'M4 later revision requires a predecessor';
    end if;
    select fixture_key,model_id,revision,committed_at into v_prev
    from ff_private.ff_m4_shadow_entries
    where id=new.previous_entry_id for update;
    if not found or v_prev.fixture_key is distinct from new.fixture_key
       or v_prev.model_id is distinct from new.model_id
       or v_prev.revision <> new.revision-1
       or v_prev.committed_at > new.committed_at then
      raise exception 'M4 revision lineage invalid';
    end if;
  end if;
  return new;
end;
$m4$;

revoke all on function ff_private.ff_m4_model_insert_guard() from
  public,anon,authenticated,service_role;
revoke all on function ff_private.ff_m4_capture_insert_guard() from
  public,anon,authenticated,service_role;
revoke all on function ff_private.ff_m4_entry_insert_guard() from
  public,anon,authenticated,service_role;

create trigger ff_m4_model_server_clock before insert
  on ff_private.ff_m4_candidate_models for each row
  execute function ff_private.ff_m4_model_insert_guard();
create trigger ff_m4_capture_server_clock before insert
  on ff_private.ff_m4_future_captures for each row
  execute function ff_private.ff_m4_capture_insert_guard();
create trigger ff_m4_entry_pre_kickoff before insert
  on ff_private.ff_m4_shadow_entries for each row
  execute function ff_private.ff_m4_entry_insert_guard();

-- No browser or service-role SELECT/INSERT/UPDATE/DELETE, even with bypassrls.
alter table ff_private.ff_m4_candidate_models enable row level security;
alter table ff_private.ff_m4_candidate_models force row level security;
alter table ff_private.ff_m4_future_captures enable row level security;
alter table ff_private.ff_m4_future_captures force row level security;
alter table ff_private.ff_m4_shadow_entries enable row level security;
alter table ff_private.ff_m4_shadow_entries force row level security;
revoke all on ff_private.ff_m4_candidate_models,
  ff_private.ff_m4_future_captures,ff_private.ff_m4_shadow_entries
  from public,anon,authenticated,service_role;

create trigger ff_m4_model_immutable before update or delete
  on ff_private.ff_m4_candidate_models for each row
  execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m4_model_no_truncate before truncate
  on ff_private.ff_m4_candidate_models for each statement
  execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m4_capture_immutable before update or delete
  on ff_private.ff_m4_future_captures for each row
  execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m4_capture_no_truncate before truncate
  on ff_private.ff_m4_future_captures for each statement
  execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m4_entries_immutable before update or delete
  on ff_private.ff_m4_shadow_entries for each row
  execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m4_entries_no_truncate before truncate
  on ff_private.ff_m4_shadow_entries for each statement
  execute function ff_private.ff_reject_ingest_mutation();

comment on table ff_private.ff_m4_candidate_models is
 'Private canonical model bytes, unapproved shadow research only. No public model.';
comment on table ff_private.ff_m4_future_captures is
 'Server-time provenance of new future metadata. Real issuer/source truth requires A5.';
comment on table ff_private.ff_m4_shadow_entries is
 'Append-only private shadow forecasts/abstentions; no public prediction rights.';
