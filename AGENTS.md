# Automation and repository hygiene

These rules apply repository-wide to human maintainers and coding agents.

1. Treat GitHub `main`, active PRs, ROADMAP and open issues as the source of truth. Read their current state before starting; do not repeat completed work.
2. **Do not multiply branches, pull requests, issues or workflow variants.** Create only when a real change needs them. Continue an existing PR for the same workstream, or add findings to an existing issue. Use one small, cohesive branch/PR for related changes.
3. Preserve unrelated branches and work. Never close or delete an in-progress PR merely for aesthetic cleanup. Close superseded/obsolete PRs with reasons; remove associated branches after confirming their unique commits are not needed.
4. Do not commit directly to protected `main`, bypass required checks, force push shared history, or disable security controls. Before merging, confirm required checks on the **exact** PR HEAD; afterward confirm `main` CI.
5. Keep Dependabot noise under control: group compatible routine updates, cap open version-update PRs and review breaking changes deliberately. Keep security updates enabled.
6. Keep README concise and accurate; update existing documentation and issues instead of producing repetitive status files. Do not commit secrets, provider-restricted football data, model artifacts or personal information.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [ROADMAP.md](ROADMAP.md) and [data-source policy](docs/DATA_SOURCES.md).
