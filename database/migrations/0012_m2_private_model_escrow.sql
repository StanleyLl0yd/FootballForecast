-- M2: private, immutable training-only OpenFootball coefficient escrow.
-- No sealed 2025/26 holdout access, no public browser grants or predictions.
create table ff_private.ff_m2_training_model_escrow (
  id uuid primary key default gen_random_uuid(),
  protocol text not null check (protocol = 'm2-openfootball-calendar-v1'),
  source_commit text not null check (
    source_commit = '63df627f3c87ce71708f016522ea236cf74332c3'),
  source_blob_sha1 text not null check (
    source_blob_sha1 = '6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc'),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  code_sha text not null check (code_sha ~ '^[a-f0-9]{40}$'),
  train_rows_sha256 text not null check (train_rows_sha256 ~ '^[a-f0-9]{64}$'),
  club_mapping_sha256 text not null check (club_mapping_sha256 ~ '^[a-f0-9]{64}$'),
  fitted_model_sha256 text not null check (fitted_model_sha256 ~ '^[a-f0-9]{64}$'),
  model_artifact_sha256 text not null check (model_artifact_sha256 ~ '^[a-f0-9]{64}$'),
  model_bytes bytea not null check (octet_length(model_bytes) between 1 and 8192),
  training_matches integer not null check (training_matches = 240),
  training_clubs integer not null check (training_clubs = 16),
  github_run_id bigint not null unique check (github_run_id > 0),
  research_state text not null default 'TRAIN_ONLY_UNAPPROVED'
    check (research_state = 'TRAIN_ONLY_UNAPPROVED'),
  holdout_read boolean not null default false check (holdout_read = false),
  model_approved boolean not null default false check (model_approved = false),
  created_at timestamptz not null default now(),
  check (model_artifact_sha256 = encode(sha256(model_bytes), 'hex')),
  unique (protocol, code_sha, source_sha256, train_rows_sha256,
    club_mapping_sha256, fitted_model_sha256)
);

-- Defense in depth against REST / client roles and accidental privileged mutations.
alter table ff_private.ff_m2_training_model_escrow enable row level security;
alter table ff_private.ff_m2_training_model_escrow force row level security;
revoke all on ff_private.ff_m2_training_model_escrow from
  public, anon, authenticated, service_role;
create trigger ff_m2_model_escrow_immutable
  before update or delete on ff_private.ff_m2_training_model_escrow
  for each row execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m2_model_escrow_no_truncate
  before truncate on ff_private.ff_m2_training_model_escrow
  for each statement execute function ff_private.ff_reject_ingest_mutation();

comment on table ff_private.ff_m2_training_model_escrow is
  'Owner-only immutable private coefficients for CC0 2024/25 train-only research. '
  'Not a model approval, sealed holdout permission, or production forecast source.';
comment on column ff_private.ff_m2_training_model_escrow.model_bytes is
  'Canonical private model bytes: never expose via API, browser, public artifact or logs.';
