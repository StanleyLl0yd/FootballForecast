-- M1 private provider-mapping FK indexes; performance-only, no new API privileges.
-- The existing provider and fixture mapping tables remain RLS-denied by default.
create index if not exists ff_provider_team_links_team_id_idx
  on ff_private.ff_provider_team_links(team_id);
create index if not exists ff_published_fixture_links_match_id_idx
  on ff_private.ff_published_fixture_links(match_id);
