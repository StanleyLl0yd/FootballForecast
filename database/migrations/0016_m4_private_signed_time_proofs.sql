-- M4-A5 protected-only cryptographic evidence for genuinely future shadow captures.
-- Real OIDC signature verification MUST happen in the reviewed owner runner.
-- PostgreSQL enforces hash linkage, immutability, no public API access, and
-- authoritative commit clock. No table/function grants to client roles.
create table ff_private.ff_m4_time_proofs (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null unique
    references ff_private.ff_m4_future_captures(id),
  github_run_id bigint not null check (github_run_id > 0),
  github_run_attempt integer not null check (github_run_attempt > 0),
  code_sha text not null check (code_sha ~ '^[a-f0-9]{40}$'),
  source_oidc_jwt text not null
    check (length(source_oidc_jwt) between 400 and 10000),
  kickoff_oidc_jwt text not null
    check (length(kickoff_oidc_jwt) between 400 and 10000),
  source_jwk jsonb not null check (jsonb_typeof(source_jwk) = 'object'),
  kickoff_jwk jsonb not null check (jsonb_typeof(kickoff_jwk) = 'object'),
  source_token_sha256 text not null check (
    source_token_sha256 ~ '^[a-f0-9]{64}$' and
    source_token_sha256 =
      encode(sha256(convert_to(source_oidc_jwt,'UTF8')),'hex')
  ),
  kickoff_token_sha256 text not null check (
    kickoff_token_sha256 ~ '^[a-f0-9]{64}$' and
    kickoff_token_sha256 =
      encode(sha256(convert_to(kickoff_oidc_jwt,'UTF8')),'hex')
  ),
  source_issued_at timestamptz not null,
  kickoff_issued_at timestamptz not null,
  committed_at timestamptz not null default clock_timestamp(),
  model_approved boolean not null default false check (model_approved = false),
  publication_allowed boolean not null default false
    check (publication_allowed = false),
  holdout_2025_26_read boolean not null default false
    check (holdout_2025_26_read = false),
  check (source_token_sha256 <> kickoff_token_sha256),
  check (source_oidc_jwt <> kickoff_oidc_jwt),
  check (source_issued_at <= kickoff_issued_at)
);

create function ff_private.ff_m4_time_proof_insert_guard()
returns trigger language plpgsql set search_path = '' as $m4$
declare
  v_cap record;
  v_now timestamptz;
begin
  -- This is a linkage/clock check, NOT a replacement for RS256 validation.
  select source_issuer,kickoff_issuer,
         source_mac_sha256,kickoff_mac_sha256,
         source_observed_at,kickoff_observed_at,kickoff_at,captured_at
    into v_cap
  from ff_private.ff_m4_future_captures
  where id = new.capture_id for update;
  if not found
     or v_cap.source_issuer <> 'openfoot'
     or v_cap.kickoff_issuer <> 'matchtv'
     or v_cap.source_mac_sha256 <> new.source_token_sha256
     or v_cap.kickoff_mac_sha256 <> new.kickoff_token_sha256
     or v_cap.source_observed_at <> new.source_issued_at
     or v_cap.kickoff_observed_at <> new.kickoff_issued_at
     or new.source_issued_at > new.kickoff_issued_at then
    raise exception 'M4 cryptographic receipt does not match source capture';
  end if;
  v_now := clock_timestamp();
  new.committed_at := v_now;
  if v_cap.captured_at > v_now
     or v_now > new.kickoff_issued_at + interval '2 hours'
     or v_now + interval '15 minutes' > v_cap.kickoff_at then
    raise exception 'M4 cryptographic receipt must precede kickoff';
  end if;
  return new;
end;
$m4$;
revoke all on function ff_private.ff_m4_time_proof_insert_guard()
  from public,anon,authenticated,service_role;
create trigger ff_m4_proof_server_clock before insert
  on ff_private.ff_m4_time_proofs for each row
  execute function ff_private.ff_m4_time_proof_insert_guard();

alter table ff_private.ff_m4_time_proofs enable row level security;
alter table ff_private.ff_m4_time_proofs force row level security;
revoke all on ff_private.ff_m4_time_proofs
  from public,anon,authenticated,service_role;

create trigger ff_m4_proofs_immutable before update or delete
  on ff_private.ff_m4_time_proofs for each row
  execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m4_proofs_no_truncate before truncate
  on ff_private.ff_m4_time_proofs for each statement
  execute function ff_private.ff_reject_ingest_mutation();

comment on table ff_private.ff_m4_time_proofs is
 'Owner-only sealed signed GitHub OIDC JWTs and public verification JWKs for '
 'immutable RPL future captures. Hash/clock linkage checked by PG; cryptographic '
 'signature, source independence and run identity checked before insert in '
 'protected owner workflow. No public release or model approval.';
