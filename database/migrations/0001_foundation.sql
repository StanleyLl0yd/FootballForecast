-- M0 schema. Apply through an authorized migration connection, never from the browser.
-- RLS is deny by default. Application owner registration is manual and auditable.
create extension if not exists pgcrypto;

create table if not exists public.ff_access_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider_id text not null unique,
  role text not null check (role in ('viewer','operator','administrator')),
  created_at timestamptz not null default now()
);

create table if not exists public.ff_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  license_status text not null default 'unverified' check (license_status in ('unverified', 'approved', 'rejected')),
  license_reference text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (license_status <> 'approved' or license_reference is not null)
);

create table if not exists public.ff_competitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  timezone text not null default 'Europe/Moscow'
);

create table if not exists public.ff_seasons (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.ff_competitions(id),
  name text not null,
  unique (competition_id, name)
);

create table if not exists public.ff_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique
);

create table if not exists public.ff_matches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.ff_seasons(id),
  home_id uuid not null references public.ff_teams(id),
  away_id uuid not null references public.ff_teams(id),
  kickoff_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished','postponed','cancelled','awarded')),
  home_goals integer check (home_goals >= 0),
  away_goals integer check (away_goals >= 0),
  updated_at timestamptz not null default now(),
  check (home_id <> away_id),
  check ((home_goals is null and away_goals is null) or (home_goals is not null and away_goals is not null)),
  check (status not in ('finished','awarded') or home_goals is not null)
);
create index if not exists ff_matches_kickoff_idx on public.ff_matches (kickoff_at);

create table if not exists public.ff_source_records (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.ff_sources(id),
  provider_id text not null,
  source_version text not null,
  event_at timestamptz not null,
  published_at timestamptz,
  ingested_at timestamptz not null default now(),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  unique (source_id, provider_id, content_hash),
  check (published_at is null or published_at <= ingested_at)
);

create table if not exists public.ff_forecasts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.ff_matches(id),
  revision integer not null check (revision > 0),
  predicted_at timestamptz not null,
  as_of_at timestamptz not null,
  model_version text not null,
  dataset_sha256 text not null check (dataset_sha256 ~ '^[a-f0-9]{64}$'),
  model_sha256 text not null check (model_sha256 ~ '^[a-f0-9]{64}$'),
  prediction_sha256 text not null check (prediction_sha256 ~ '^[a-f0-9]{64}$'),
  commit_sha text not null check (commit_sha ~ '^[a-f0-9]{40}$'),
  home_win double precision not null check (home_win between 0 and 1),
  draw double precision not null check (draw between 0 and 1),
  away_win double precision not null check (away_win between 0 and 1),
  expected_home double precision not null check (expected_home between 0 and 15),
  expected_away double precision not null check (expected_away between 0 and 15),
  score_distribution jsonb not null,
  unique (match_id, revision),
  check (as_of_at <= predicted_at),
  check (abs(home_win + draw + away_win - 1.0) < 0.000000001)
);

create table if not exists public.ff_forecast_outcomes (
  id uuid primary key default gen_random_uuid(),
  forecast_id uuid not null unique references public.ff_forecasts(id),
  evaluated_at timestamptz not null default now(),
  result_home integer not null check (result_home >= 0),
  result_away integer not null check (result_away >= 0),
  log_loss double precision not null check (log_loss >= 0),
  brier double precision not null check (brier between 0 and 2),
  rps double precision not null check (rps between 0 and 2)
);

create or replace function public.ff_guard_forecast_insert() returns trigger
language plpgsql set search_path = '' as $$
declare match_kickoff timestamptz;
begin
  select kickoff_at into match_kickoff from public.ff_matches where id = new.match_id;
  if match_kickoff is null or new.predicted_at >= match_kickoff
    or clock_timestamp() >= match_kickoff then
    raise exception 'Forecast must be published before match kickoff';
  end if;
  if new.predicted_at > clock_timestamp() + interval '30 seconds'
    or new.predicted_at < clock_timestamp() - interval '5 minutes' then
    raise exception 'Forecast publication time must correspond to actual insertion';
  end if;
  return new;
end;
$$;

-- Historical simulated forecasts belong in a distinct backtesting table.
-- A real archive must never accept backdated publication as if it were live.
create or replace function public.ff_guard_outcome_insert() returns trigger
language plpgsql set search_path = '' as $$
declare actual_home integer;
declare actual_away integer;
declare match_status text;
declare kickoff timestamptz;
begin
  select m.home_goals, m.away_goals, m.status, m.kickoff_at
    into actual_home, actual_away, match_status, kickoff
  from public.ff_matches m join public.ff_forecasts f on f.match_id = m.id
  where f.id = new.forecast_id;
  if match_status is distinct from 'finished'
    or new.result_home is distinct from actual_home
    or new.result_away is distinct from actual_away
    or new.evaluated_at < kickoff
    or clock_timestamp() < kickoff then
    raise exception 'Outcome requires a matching finished fixture';
  end if;
  return new;
end;
$$;

create or replace function public.ff_append_only_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Append-only: update/delete prohibited';
end;
$$;

drop trigger if exists ff_forecast_preinsert on public.ff_forecasts;
create trigger ff_forecast_preinsert before insert on public.ff_forecasts
for each row execute function public.ff_guard_forecast_insert();
drop trigger if exists ff_forecast_immutable on public.ff_forecasts;
create trigger ff_forecast_immutable before update or delete on public.ff_forecasts
for each row execute function public.ff_append_only_guard();
drop trigger if exists ff_outcomes_preinsert on public.ff_forecast_outcomes;
create trigger ff_outcomes_preinsert before insert on public.ff_forecast_outcomes
for each row execute function public.ff_guard_outcome_insert();
drop trigger if exists ff_outcomes_immutable on public.ff_forecast_outcomes;
create trigger ff_outcomes_immutable before update or delete on public.ff_forecast_outcomes
for each row execute function public.ff_append_only_guard();

-- Only users explicitly provisioned by DB admin can read these tables.
create or replace function public.ff_is_authorized() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ff_access_grants where user_id = (select auth.uid()));
$$;
revoke all on function public.ff_is_authorized() from public;
grant execute on function public.ff_is_authorized() to authenticated;

alter table public.ff_access_grants enable row level security;
create policy ff_grants_self on public.ff_access_grants for select to authenticated using (user_id = (select auth.uid()));

-- No browser insert/update/delete policies. Worker requires a separate trusted backend.
alter table public.ff_sources enable row level security;
alter table public.ff_competitions enable row level security;
alter table public.ff_seasons enable row level security;
alter table public.ff_teams enable row level security;
alter table public.ff_matches enable row level security;
alter table public.ff_source_records enable row level security;
alter table public.ff_forecasts enable row level security;
alter table public.ff_forecast_outcomes enable row level security;
create policy ff_sources_read on public.ff_sources for select to authenticated using (public.ff_is_authorized());
create policy ff_competitions_read on public.ff_competitions for select to authenticated using (public.ff_is_authorized());
create policy ff_seasons_read on public.ff_seasons for select to authenticated using (public.ff_is_authorized());
create policy ff_teams_read on public.ff_teams for select to authenticated using (public.ff_is_authorized());
create policy ff_matches_read on public.ff_matches for select to authenticated using (public.ff_is_authorized());
create policy ff_source_records_read on public.ff_source_records for select to authenticated using (public.ff_is_authorized());
create policy ff_forecasts_read on public.ff_forecasts for select to authenticated using (public.ff_is_authorized());
create policy ff_outcomes_read on public.ff_forecast_outcomes for select to authenticated using (public.ff_is_authorized());
