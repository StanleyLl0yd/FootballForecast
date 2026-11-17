-- M4-A6 preparatory private post-match observation and CANDIDATE settlement.
-- These tables alone DO NOT authenticate an independent published played score.
-- The protected owner worker must verify publisher source, OIDC RS256 signatures,
-- original A5 fixture/provider mapping, real server time and played status.
-- No public views/grants. No scores, forecasts, holdout or model approval.
-- No automatic result collection, promotion, scoring or publication here.

create table ff_private.ff_m4_result_observations (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references ff_private.ff_m4_future_captures(id),
  source_issuer text not null check (
    source_issuer in ('openfoot','matchtv')),
  source_fixture_ref text not null check (
    source_fixture_ref ~ '^[A-Za-z0-9_.:-]{2,160}$'),
  source_response_sha256 text not null check (
    source_response_sha256 ~ '^[a-f0-9]{64}$'),
  source_oidc_jwt text not null
    check (length(source_oidc_jwt) between 400 and 10000),
  source_jwk jsonb not null
    check (jsonb_typeof(source_jwk) = 'object'),
  source_token_sha256 text not null unique check (
    source_token_sha256 ~ '^[a-f0-9]{64}$' and
    source_token_sha256 =
      encode(sha256(convert_to(source_oidc_jwt,'UTF8')),'hex')),
  source_issued_at timestamptz not null,
  github_run_id bigint not null check (github_run_id > 0),
  github_run_attempt integer not null check (github_run_attempt > 0),
  code_sha text not null check (code_sha ~ '^[a-f0-9]{40}$'),
  fixture_key text not null,
  kickoff_at timestamptz not null,
  home_club_key text not null,
  away_club_key text not null,
  status text not null check (status = 'finished'),
  result_kind text not null check (result_kind = 'played'),
  home_goals integer not null check (home_goals between 0 and 20),
  away_goals integer not null check (away_goals between 0 and 20),
  recorded_at timestamptz not null default clock_timestamp(),
  result_attested boolean not null default false check (result_attested = false),
  publication_allowed boolean not null default false
    check (publication_allowed = false),
  holdout_2025_26_read boolean not null default false
    check (holdout_2025_26_read = false),
  unique (capture_id,source_issuer,source_response_sha256),
  unique (capture_id,github_run_id,github_run_attempt,source_issuer)
);
create index ff_m4_result_observation_capture_idx
  on ff_private.ff_m4_result_observations(capture_id,recorded_at);

create table ff_private.ff_m4_result_candidate_settlements (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references ff_private.ff_m4_future_captures(id),
  shadow_entry_id uuid not null references ff_private.ff_m4_shadow_entries(id),
  primary_observation_id uuid not null
    references ff_private.ff_m4_result_observations(id),
  corroboration_observation_id uuid not null
    references ff_private.ff_m4_result_observations(id),
  revision integer not null check (revision between 1 and 100),
  previous_settlement_id uuid
    references ff_private.ff_m4_result_candidate_settlements(id),
  home_goals integer not null check (home_goals between 0 and 20),
  away_goals integer not null check (away_goals between 0 and 20),
  recorded_at timestamptz not null default clock_timestamp(),
  state text not null default 'PRIVATE_RESULT_CANDIDATE_UNATTESTED'
    check (state = 'PRIVATE_RESULT_CANDIDATE_UNATTESTED'),
  settlement_authorized boolean not null default false
    check (settlement_authorized = false),
  model_approved boolean not null default false
    check (model_approved = false),
  publication_allowed boolean not null default false
    check (publication_allowed = false),
  holdout_2025_26_read boolean not null default false
    check (holdout_2025_26_read = false),
  check (primary_observation_id <> corroboration_observation_id),
  unique (capture_id,revision),
  unique (primary_observation_id,corroboration_observation_id)
);
create index ff_m4_result_settlement_capture_idx
  on ff_private.ff_m4_result_candidate_settlements(capture_id,recorded_at);

create function ff_private.ff_m4_result_observation_insert_guard()
returns trigger language plpgsql set search_path = '' as $m4$
declare
  v_cap record;
  v_proof record;
  v_now timestamptz;
begin
  select fixture_key,kickoff_at,home_club_key,away_club_key,captured_at
    into v_cap
  from ff_private.ff_m4_future_captures
  where id=new.capture_id for share;
  select source_match_id,committed_at into v_proof
  from ff_private.ff_m4_time_proofs
  where capture_id=new.capture_id for share;
  v_now := clock_timestamp();
  new.recorded_at := v_now;
  if v_cap.fixture_key is null or v_proof.source_match_id is null
     or new.fixture_key is distinct from v_cap.fixture_key
     or new.kickoff_at is distinct from v_cap.kickoff_at
     or new.home_club_key is distinct from v_cap.home_club_key
     or new.away_club_key is distinct from v_cap.away_club_key
     or (new.source_issuer='openfoot' and
         new.source_fixture_ref is distinct from v_proof.source_match_id)
     or (new.source_issuer='matchtv' and
         new.source_fixture_ref = v_proof.source_match_id)
     or v_cap.captured_at >= v_cap.kickoff_at - interval '15 minutes'
     or v_proof.committed_at >= v_cap.kickoff_at - interval '15 minutes'
     or new.source_issued_at < v_cap.kickoff_at + interval '90 minutes'
     or v_now < v_cap.kickoff_at + interval '90 minutes'
     or new.source_issued_at > v_now
     or new.source_issued_at < v_now - interval '20 minutes'
     or new.source_issued_at <= v_proof.committed_at then
    raise exception 'M4 result observation lacks fresh A5-linked postgame proof';
  end if;
  return new;
end;
$m4$;

create function ff_private.ff_m4_result_candidate_insert_guard()
returns trigger language plpgsql set search_path = '' as $m4$
declare
  v_cap record;
  v_entry record;
  v_primary record;
  v_other record;
  v_previous record;
  v_now timestamptz;
begin
  select kickoff_at,fixture_key into v_cap
  from ff_private.ff_m4_future_captures
  where id=new.capture_id for update;
  select capture_id,fixture_key,revision,model_id,committed_at
    into v_entry
  from ff_private.ff_m4_shadow_entries
  where id=new.shadow_entry_id for share;
  select capture_id,source_issuer,source_fixture_ref,
         source_response_sha256,source_token_sha256,
         github_run_id,github_run_attempt,code_sha,
         status,result_kind,home_goals,away_goals,recorded_at
    into v_primary
  from ff_private.ff_m4_result_observations
  where id=new.primary_observation_id for share;
  select capture_id,source_issuer,source_fixture_ref,
         source_response_sha256,source_token_sha256,
         github_run_id,github_run_attempt,code_sha,
         status,result_kind,home_goals,away_goals,recorded_at
    into v_other
  from ff_private.ff_m4_result_observations
  where id=new.corroboration_observation_id for share;

  v_now := clock_timestamp();
  new.recorded_at := v_now;
  if v_cap.fixture_key is null or v_entry.fixture_key is null
     or v_primary.source_issuer is null or v_other.source_issuer is null
     or v_entry.capture_id <> new.capture_id
     or v_entry.fixture_key <> v_cap.fixture_key
     or v_primary.capture_id <> new.capture_id
     or v_other.capture_id <> new.capture_id
     or v_primary.source_issuer <> 'openfoot'
     or v_other.source_issuer <> 'matchtv'
     or v_primary.source_response_sha256 = v_other.source_response_sha256
     or v_primary.source_token_sha256 = v_other.source_token_sha256
     or v_primary.github_run_id <> v_other.github_run_id
     or v_primary.github_run_attempt <> v_other.github_run_attempt
     or v_primary.code_sha <> v_other.code_sha
     or v_primary.status <> 'finished' or v_other.status <> 'finished'
     or v_primary.result_kind <> 'played'
     or v_other.result_kind <> 'played'
     or v_primary.home_goals <> v_other.home_goals
     or v_primary.away_goals <> v_other.away_goals
     or new.home_goals <> v_primary.home_goals
     or new.away_goals <> v_primary.away_goals
     or v_entry.committed_at > v_cap.kickoff_at - interval '15 minutes'
     or exists (
       select 1 from ff_private.ff_m4_shadow_entries e
       where e.fixture_key=v_cap.fixture_key
         and e.model_id=v_entry.model_id
         and e.revision > v_entry.revision)
     or v_now < v_cap.kickoff_at + interval '90 minutes'
     or v_now < v_primary.recorded_at
     or v_now < v_other.recorded_at
     or v_now > v_primary.recorded_at + interval '20 minutes'
     or v_now > v_other.recorded_at + interval '20 minutes' then
    raise exception 'M4 candidate settlement has no consistent A5/played evidence';
  end if;
  if new.revision=1 then
    if new.previous_settlement_id is not null then
      raise exception 'M4 first result settlement must lack predecessor';
    end if;
  else
    select capture_id,revision,recorded_at,
           primary_observation_id,corroboration_observation_id
      into v_previous
    from ff_private.ff_m4_result_candidate_settlements
    where id=new.previous_settlement_id for update;
    if v_previous.capture_id is null
       or v_previous.capture_id <> new.capture_id
       or v_previous.revision <> new.revision-1
       or v_previous.recorded_at > v_now
       or (v_previous.primary_observation_id = new.primary_observation_id
           and v_previous.corroboration_observation_id =
             new.corroboration_observation_id) then
      raise exception 'M4 result revision lineage invalid';
    end if;
  end if;
  return new;
end;
$m4$;

revoke all on function ff_private.ff_m4_result_observation_insert_guard()
  from public,anon,authenticated,service_role;
revoke all on function ff_private.ff_m4_result_candidate_insert_guard()
  from public,anon,authenticated,service_role;

create trigger ff_m4_result_observation_server_clock before insert
  on ff_private.ff_m4_result_observations for each row
  execute function ff_private.ff_m4_result_observation_insert_guard();
create trigger ff_m4_result_candidate_server_clock before insert
  on ff_private.ff_m4_result_candidate_settlements for each row
  execute function ff_private.ff_m4_result_candidate_insert_guard();

alter table ff_private.ff_m4_result_observations enable row level security;
alter table ff_private.ff_m4_result_observations force row level security;
alter table ff_private.ff_m4_result_candidate_settlements enable row level security;
alter table ff_private.ff_m4_result_candidate_settlements force row level security;
revoke all on ff_private.ff_m4_result_observations,
  ff_private.ff_m4_result_candidate_settlements
  from public,anon,authenticated,service_role;

create trigger ff_m4_result_observations_immutable before update or delete
  on ff_private.ff_m4_result_observations for each row
  execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m4_result_observations_no_truncate before truncate
  on ff_private.ff_m4_result_observations for each statement
  execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m4_candidate_results_immutable before update or delete
  on ff_private.ff_m4_result_candidate_settlements for each row
  execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m4_candidate_results_no_truncate before truncate
  on ff_private.ff_m4_result_candidate_settlements for each statement
  execute function ff_private.ff_reject_ingest_mutation();

comment on table ff_private.ff_m4_result_observations is
 'Private postgame source claims, GitHub token bytes, UNVERIFIED until an independently reviewed source worker';
comment on table ff_private.ff_m4_result_candidate_settlements is
 'Append-only result candidates; never score or publish without separate A6 independent truth review';
