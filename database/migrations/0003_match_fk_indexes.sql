-- M0 PostgreSQL FK indexes recommended by the Supabase performance advisor.
-- This is a non-destructive change. Do not remove kickoff index merely because
-- it has no scans before licensed match data exist.
create index if not exists ff_matches_season_id_idx on public.ff_matches (season_id);
create index if not exists ff_matches_home_id_idx on public.ff_matches (home_id);
create index if not exists ff_matches_away_id_idx on public.ff_matches (away_id);
