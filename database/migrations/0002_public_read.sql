-- M0 public anonymous READ ONLY contract. Applies after 0001_foundation.
-- The only public tables contain non-personal catalog/results/forecast data.
-- Provider ingestion records, source rights and access grants remain private.
-- This migration intentionally does NOT seed fabricated sports data.
revoke all on public.ff_competitions, public.ff_seasons, public.ff_teams,
  public.ff_matches, public.ff_forecasts, public.ff_forecast_outcomes from anon;
grant select on public.ff_competitions, public.ff_seasons, public.ff_teams,
  public.ff_matches, public.ff_forecasts, public.ff_forecast_outcomes to anon;

create policy ff_competitions_public_read on public.ff_competitions for select to anon using (true);
create policy ff_seasons_public_read on public.ff_seasons for select to anon using (true);
create policy ff_teams_public_read on public.ff_teams for select to anon using (true);
create policy ff_matches_public_read on public.ff_matches for select to anon using (true);
create policy ff_forecasts_public_read on public.ff_forecasts for select to anon using (true);
create policy ff_outcomes_public_read on public.ff_forecast_outcomes for select to anon using (true);

-- Explicitly deny writes even if inherited default grants change later.
revoke insert, update, delete, truncate, references, trigger on
 public.ff_competitions, public.ff_seasons, public.ff_teams, public.ff_matches,
 public.ff_forecasts, public.ff_forecast_outcomes from anon;
