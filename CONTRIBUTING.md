# Contributing

FootballForecast is in early development. Useful contributions include reproducible bug reports, documentation improvements, football-data licensing research and independently testable model methodology.

- Open an issue before proposing substantial architectural changes.
- Keep pull requests focused, with relevant automated tests.
- Do not include credentials, personal data, proprietary match datasets or unlicensed assets.
- Record data provenance and availability timestamps; never introduce future-data leakage into backtests.
- Do not claim predictive accuracy without independent out-of-sample evidence.
- Please report security vulnerabilities privately, following [SECURITY.md](SECURITY.md).

## Branch and pull request hygiene

- Use **one short-lived branch and PR per distinct, reviewable change**. Reuse the existing branch/PR when continuing the same task; do not fork parallel replacements.
- Check `main`, open PRs and issues **before** creating anything. A research or status update belongs in the existing issue or documentation, not in an empty PR.
- Combine closely related fixes and documentation into a single tested PR; avoid tiny sequential PRs and broad unrelated refactors.
- Don't merge without the required exact-head checks. Don't bypass branch protection for convenience.
- After a PR is merged or deliberately closed, delete its branch **only after** confirming no other open PR or unmerged work needs it. Preserve `main`, release branches and user-owned work.
- Prefer updating or closing superseded issues/PRs with a brief reason to opening duplicates. Keep README user-facing, not a running status log.
- Routine Dependabot updates are weekly, grouped when compatible, and limited in number. Breaking upgrades require an explicit compatibility need; never auto-merge them.

**Licensing note:** there is no public software license yet. Public visibility does not automatically grant permission to reuse or redistribute code.
