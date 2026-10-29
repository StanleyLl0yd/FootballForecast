-- M1: append-only private source snapshot staging. No public API and no worker grants.
-- Run after 0004_match_status_scores. A separate non-browser privileged worker is
-- required for inserts. No fixture is automatically promoted into public tables.
create table if not exists ff_private.ff_ingest_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.ff_sources(id),
  source_url text not null,
  license_url text not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}
  created_at timestamptz not null default now(),
  unique (source_id, source_sha256, retrieved_at),
  check (length(source_url) between 12 and 512),
  check (length(license_url) between 12 and 512)
);

create table if not exists ff_private.ff_ingest_matches (
  snapshot_id uuid not null references ff_private.ff_ingest_snapshots(id),
  source_match_id text not null check (length(source_match_id) between 1 and 100),
  season text not null check (season in ('2024/2025','2025/2026','2026/2027')),
  dataset_role text not null check (dataset_role in ('train_baseline','sealed_holdout','current')),
  home_source_id text not null check (length(home_source_id) between 1 and 100),
  away_source_id text not null check (length(away_source_id) between 1 and 100),
  home_name text not null check (length(home_name) between 1 and 120),
  away_name text not null check (length(away_name) between 1 and 120),
  calendar_date_utc date,
  kickoff_at timestamptz,
  kickoff_time_confirmed boolean not null,
  status text not null check (status in ('scheduled','live','finished','cancelled','postponed','awarded')),
  home_goals integer,
  away_goals integer,
  quarantine_reason text,
  published_at timestamptz,
  primary key (snapshot_id, source_match_id),
  unique (snapshot_id, season, home_source_id, away_source_id),
  check (home_source_id <> away_source_id),
  check ((season = '2024/2025' and dataset_role = 'train_baseline')
      or (season = '2025/2026' and dataset_role = 'sealed_holdout')
      or (season = '2026/2027' and dataset_role = 'current')),
  check (kickoff_time_confirmed = (kickoff_at is not null)),
  check (calendar_date_utc is not null or quarantine_reason is not null),
  check (quarantine_reason is null or length(quarantine_reason) between 1 and 80),
  check ((home_goals is null and away_goals is null)
      or (home_goals between 0 and 20 and away_goals between 0 and 20)),
  check ((status = 'finished' and (home_goals is not null or quarantine_reason is not null))
      or (status <> 'finished' and home_goals is null and away_goals is null)),
  check (status = 'finished' or quarantine_reason is not null or status = 'scheduled')
);
create index if not exists ff_ingest_matches_season_role_idx
  on ff_private.ff_ingest_matches (season, dataset_role);

-- Audit snapshots must never be silently overwritten: each upstream revision
-- has a different content hash and adds a new immutable set of records.
create or replace function ff_private.ff_reject_ingest_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Source snapshot history is append-only';
end;
$$;
revoke all on function ff_private.ff_reject_ingest_mutation() from public, anon, authenticated;

drop trigger if exists ff_ingest_snapshots_immutable on ff_private.ff_ingest_snapshots;
create trigger ff_ingest_snapshots_immutable
  before update or delete on ff_private.ff_ingest_snapshots
  for each row execute function ff_private.ff_reject_ingest_mutation();

drop trigger if exists ff_ingest_matches_immutable on ff_private.ff_ingest_matches;
create trigger ff_ingest_matches_immutable
  before update or delete on ff_private.ff_ingest_matches
  for each row execute function ff_private.ff_reject_ingest_mutation();

alter table ff_private.ff_ingest_snapshots enable row level security;
alter table ff_private.ff_ingest_matches enable row level security;
revoke all on ff_private.ff_ingest_snapshots,
  ff_private.ff_ingest_matches from public, anon, authenticated;
revoke all on schema ff_private from anon;
-- An authenticated user retains the existing limited schema usage for the
-- security-definer authorization helper, not access to these private tables.
),
  normalized_sha256 jsonb not null check (jsonb_typeof(normalized_sha256) = 'object'),
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (source_id, source_sha256),
  check (length(source_url) between 12 and 512),
  check (length(license_url) between 12 and 512)
);

create table if not exists ff_private.ff_ingest_matches (
  snapshot_id uuid not null references ff_private.ff_ingest_snapshots(id),
  source_match_id text not null check (length(source_match_id) between 1 and 100),
  season text not null check (season in ('2024/2025','2025/2026','2026/2027')),
  dataset_role text not null check (dataset_role in ('train_baseline','sealed_holdout','current')),
  home_source_id text not null check (length(home_source_id) between 1 and 100),
  away_source_id text not null check (length(away_source_id) between 1 and 100),
  home_name text not null check (length(home_name) between 1 and 120),
  away_name text not null check (length(away_name) between 1 and 120),
  calendar_date_utc date,
  kickoff_at timestamptz,
  kickoff_time_confirmed boolean not null,
  status text not null check (status in ('scheduled','live','finished','cancelled','postponed','awarded')),
  home_goals integer,
  away_goals integer,
  quarantine_reason text,
  published_at timestamptz,
  primary key (snapshot_id, source_match_id),
  unique (snapshot_id, season, home_source_id, away_source_id),
  check (home_source_id <> away_source_id),
  check ((season = '2024/2025' and dataset_role = 'train_baseline')
      or (season = '2025/2026' and dataset_role = 'sealed_holdout')
      or (season = '2026/2027' and dataset_role = 'current')),
  check (kickoff_time_confirmed = (kickoff_at is not null)),
  check (calendar_date_utc is not null or quarantine_reason is not null),
  check (quarantine_reason is null or length(quarantine_reason) between 1 and 80),
  check ((home_goals is null and away_goals is null)
      or (home_goals between 0 and 20 and away_goals between 0 and 20)),
  check ((status = 'finished' and (home_goals is not null or quarantine_reason is not null))
      or (status <> 'finished' and home_goals is null and away_goals is null)),
  check (status = 'finished' or quarantine_reason is not null or status = 'scheduled')
);
create index if not exists ff_ingest_matches_season_role_idx
  on ff_private.ff_ingest_matches (season, dataset_role);

-- Audit snapshots must never be silently overwritten: each upstream revision
-- has a different content hash and adds a new immutable set of records.
create or replace function ff_private.ff_reject_ingest_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Source snapshot history is append-only';
end;
$$;
revoke all on function ff_private.ff_reject_ingest_mutation() from public, anon, authenticated;

drop trigger if exists ff_ingest_snapshots_immutable on ff_private.ff_ingest_snapshots;
create trigger ff_ingest_snapshots_immutable
  before update or delete on ff_private.ff_ingest_snapshots
  for each row execute function ff_private.ff_reject_ingest_mutation();

drop trigger if exists ff_ingest_matches_immutable on ff_private.ff_ingest_matches;
create trigger ff_ingest_matches_immutable
  before update or delete on ff_private.ff_ingest_matches
  for each row execute function ff_private.ff_reject_ingest_mutation();

alter table ff_private.ff_ingest_snapshots enable row level security;
alter table ff_private.ff_ingest_matches enable row level security;
revoke all on ff_private.ff_ingest_snapshots,
  ff_private.ff_ingest_matches from public, anon, authenticated;
revoke all on schema ff_private from anon;
-- An authenticated user retains the existing limited schema usage for the
-- security-definer authorization helper, not access to these private tables.
