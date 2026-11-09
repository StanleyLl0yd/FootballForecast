-- M2: immutable single-use private first fixed Poisson retrospective evaluation.
-- The reservation is committed before ANY 2025/26 label fetch and cannot
-- be removed, updated, reused, or converted to a production forecast.
-- If the first run fails, it remains consumed: no result-driven reruns.
create table ff_private.ff_m2_one_use_study_claims (
  study_id text primary key check (
    study_id = 'rpl-2025-26-football-data-fixed-poisson-v1'),
  study_declaration_sha256 text not null check (
    study_declaration_sha256 ~ '^[a-f0-9]{64}$'),
  code_sha text not null check (code_sha ~ '^[a-f0-9]{40}$'),
  github_run_id bigint not null unique check (github_run_id > 0),
  predeclared_names_sha256 text not null check (
    predeclared_names_sha256 ~ '^[a-f0-9]{64}$'),
  source_uri text not null check (
    source_uri = 'https://www.football-data.co.uk/new/RUS.csv'),
  model_artifact_sha256 text not null check (
    model_artifact_sha256 =
      '5d1893ac2d3e632f979b1ec67ed751edfa38733b9faf6371fc3f5e24b97fa28d'),
  fitted_model_sha256 text not null check (
    fitted_model_sha256 =
      '987caad53cf77e4977482b4e9750b2c779912b47d0bc884cfb3807e8151ad95d'),
  research_classification text not null check (
    research_classification = 'NON_STRICT_RETROSPECTIVE'),
  source_scope text not null check (source_scope = 'OWNER_PERSONAL_RESEARCH'),
  committed_before_first_label_read boolean not null check (
    committed_before_first_label_read = true),
  prediction_publication_permitted boolean not null check (
    prediction_publication_permitted = false),
  created_at timestamptz not null default now(),
  unique (study_id, github_run_id, predeclared_names_sha256)
);

create table ff_private.ff_m2_one_use_study_results (
  study_id text primary key,
  github_run_id bigint not null unique check (github_run_id > 0),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  selected_rows_sha256 text not null check (
    selected_rows_sha256 ~ '^[a-f0-9]{64}$'),
  predeclared_names_sha256 text not null check (
    predeclared_names_sha256 ~ '^[a-f0-9]{64}$'),
  total_fixtures integer not null check (total_fixtures = 240),
  eligible_fixtures integer not null check (eligible_fixtures = 182),
  abstentions integer not null check (abstentions = 58),
  kickoff_time_quality text not null check (kickoff_time_quality = 'DAY_ONLY'),
  model_log_loss double precision not null check (
    model_log_loss between 0 and 25),
  model_brier double precision not null check (model_brier between 0 and 2),
  model_rps double precision not null check (model_rps between 0 and 2),
  prior_log_loss double precision not null check (
    prior_log_loss between 0 and 25),
  prior_brier double precision not null check (prior_brier between 0 and 2),
  prior_rps double precision not null check (prior_rps between 0 and 2),
  model_top1_accuracy double precision not null check (
    model_top1_accuracy between 0 and 1),
  prior_top1_accuracy double precision not null check (
    prior_top1_accuracy between 0 and 1),
  no_model_tuning boolean not null check (no_model_tuning = true),
  no_source_rows_published boolean not null check (
    no_source_rows_published = true),
  completed_at timestamptz not null default now(),
  foreign key (study_id, github_run_id, predeclared_names_sha256)
    references ff_private.ff_m2_one_use_study_claims (
      study_id, github_run_id, predeclared_names_sha256)
);

alter table ff_private.ff_m2_one_use_study_claims enable row level security;
alter table ff_private.ff_m2_one_use_study_claims force row level security;
alter table ff_private.ff_m2_one_use_study_results enable row level security;
alter table ff_private.ff_m2_one_use_study_results force row level security;
revoke all on ff_private.ff_m2_one_use_study_claims
  from public, anon, authenticated, service_role;
revoke all on ff_private.ff_m2_one_use_study_results
  from public, anon, authenticated, service_role;

create trigger ff_m2_one_use_claims_no_update_delete
  before update or delete on ff_private.ff_m2_one_use_study_claims
  for each row execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m2_one_use_claims_no_truncate
  before truncate on ff_private.ff_m2_one_use_study_claims
  for each statement execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m2_one_use_results_no_update_delete
  before update or delete on ff_private.ff_m2_one_use_study_results
  for each row execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m2_one_use_results_no_truncate
  before truncate on ff_private.ff_m2_one_use_study_results
  for each statement execute function ff_private.ff_reject_ingest_mutation();

comment on table ff_private.ff_m2_one_use_study_claims is
  'Private irreversible first-label-read reservation. Unique study_id; no rerun'
  ' even if source unavailable. Not an approved or published forecasting model.';
comment on table ff_private.ff_m2_one_use_study_results is
  'Private aggregate-only fixed-model score. Immutable and browser-inaccessible.';
