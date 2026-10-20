# Data and software licensing

FootballForecast is a public-source repository, but no software license has been approved by the owner. Do not presume permission to redistribute the original code or introduce a license without approval.

**Owner's binding zero-cost rule (2026-10-19): no paid sources, subscriptions, premium upgrades, trial-to-paid conversion, billing or purchases.** Restrict possible integration to genuinely free and permitted data access within provider quotas. No source may automatically upgrade or trigger paid usage. If free data is insufficient, return a missing-data state rather than suggesting a purchase. The structured [free-source priority/permissions register](M0_FREE_SOURCE_REGISTRY.json) is CI-validated; no providers are activated in M0.

The authoritative provider-by-provider permission and coverage register is [DATA_SOURCES.md](DATA_SOURCES.md). **All vendors are unapproved at M0.** A web page being public, a CSV described as free, or an API plan advertising coverage does not by itself settle extraction, retention, machine-learning training, generated-model distribution or third-party competition rights.

- The [official RPL website](https://premierliga.ru/) explicitly **prohibits any service's automated extraction of website information absent official permission from the RPL** (publisher's site footer, reviewed 2026-10-20). Its results and match protocols remain **manual primary references only**. Authority as an official source does not license automated crawling, match harvesting, bulk replication or model training; do not build a crawler against `premierliga.ru`.
- Site scraping of FootyStats is prohibited by its published terms; use only the separate API **after** verifying permitted use and access.
- FootyStats API terms allow app/model use but prohibit resale or redistribution of raw data; do not treat that as permission to mirror its database.
- API-Football terms expressly leave competition-data publication rights to the developer. Contractual vendor access and the rights of leagues, clubs, photographers and statistics creators are separate issues.
- Neither real team crests, player images, complete source records, nor paid provider credentials belong in this repository or public CI artifacts.
- Data provenance, timestamps and source revisions are mandatory; retrospectively obtained data may not be passed off as demonstrably available before kickoff.
- Paid tiers are prohibited by the current owner decision. Only explicitly free credentials may be considered later, and only after checking account setup, zero-cost entitlement, license, quota and secure key handling.

Private derived analytics may have different rights from public distribution. When in doubt, keep provider ingestion disabled and record the unresolved permission rather than guessing.
