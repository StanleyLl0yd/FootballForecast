# Automation and repository hygiene

These rules apply repository-wide to human maintainers and coding agents.

1. Treat GitHub `main`, active PRs, ROADMAP and open issues as the source of truth. Read their current state before starting; do not repeat completed work.
2. **Do not multiply branches, pull requests, issues or workflow variants.** Create only when a real change needs them. Continue an existing PR for the same workstream, or add findings to an existing issue. Use one small, cohesive branch/PR for related changes.
3. Preserve unrelated branches and work. Never close or delete an in-progress PR merely for aesthetic cleanup. Close superseded/obsolete PRs with reasons; remove associated branches after confirming their unique commits are not needed.
4. Do not commit directly to protected `main`, bypass required checks, force push shared history, or disable security controls. Before merging, confirm required checks on the **exact** PR HEAD; afterward confirm `main` CI.
5. Keep Dependabot noise under control: group compatible routine updates, cap open version-update PRs and review breaking changes deliberately. Keep security updates enabled.
6. Keep README concise and accurate; update existing documentation and issues instead of producing repetitive status files. Do not commit secrets, provider-restricted football data, model artifacts or personal information.

## Scope and instruction precedence

Applies to the entire repository, including Python ML, Next.js/TypeScript, SQL, workflows and documentation. Follow the owner's current explicit instruction first, then this file, then accepted architectural/security decisions in `docs/`, `SECURITY.md`, `ROADMAP.md` and `CONTRIBUTING.md`. If these conflict, surface the conflict instead of silently weakening a security, data-rights or statistical-integrity requirement. Keep this file as the operating contract, not an alternative to detailed design documents.

## FootballForecast invariants

- **Independent CC0 anomaly corroboration (2026-11-05):** The separate `docs/M2_CC0_RPL_ANOMALY_CORROBORATION_EVIDENCE.json` establishes a reversed 2023/24 source home/away direction using official pre-match schedule-switch evidence and separately confirms six `awarded` outcomes as unplayed technical results. Source rows/private snapshots remain unchanged. Do not auto-correct the archive, infer approval for other fixtures, treat technical results as played goals, join private IDs, train, or unseal 2025/26. M2 4/8 OPEN.

- **Independent CC0 archive review (2026-11-05):** The aggregate-only pinned snapshot `docs/M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json` covers five development seasons in `openfootball/football.json` / `openfootball/europe`. Do not treat all 240 score-bearing rows per season as played: 2019/20 has four explicit `awarded` results, 2020/21 two, and 2023/24 has 239/240 unique directed home/away pairs. Block automatic repair or adoption; require independent per-match match-ID, actual played-score, date and original publisher time/rights corroboration. Declared CC0 at repository level does not independently prove third-party source chain rights. 2025/26 remains sealed; no multiseason fit authorized.


- **2026-11-05 historical weather candidate preflight:** `rpl_weather_candidate.py` is synthetic-only and cannot approve real model features or a historical pre-match-as-of claim. Historical venue identity/location, model-run initialization, **actual earliest source availability** before midnight UTC, and rights must be independently evidenced; JMA nominal update tables and Open-Meteo `_previous_day1` cannot substitute. Never attach city-reference weather to match records. `/Ls/Leagues` appears in official SStats docs but its official bounded filter contract/rights are unverified: no further full-catalog requests or games data until established.


- **SStats #41697495298 transfer completeness:** catalog probe captured exactly 1,500,000 bytes (its configured maximum), JSON prefix invalid; full response integrity NOT verified because curl error status was previously ignored. The captured-payload SHA is not a complete-source digest. Never label a partial download as successful HTTP200 JSON, raise limits implicitly, log provider body or infer missing API coverage; all four bounded GETs must honor curl exit status and fail closed. Do not fetch games without an independently validated unique league ID and lawful terms.

- **Real 2018–2024 JMA GSM reference #41695184408:** 7/7 days, 168/168 non-null hours, without verified stadium, match as-of or historical forecast issuance. **SStats repeat #41695180516:** INCONCLUSIVE_SCHEMA, no games fetched. Future catalog probes may classify raw response only by allowlisted format/length/SHA, never output body, headers, provider messages, IDs, match rows or odds. Keep sealed 2025/26 untouched and research-only.


- **Historical fixed-lead weather research 2018–2024:** JMA GSM previous-runs anonymous owner probe may inspect only seven fixed August-1 city-reference date series and produce hour counts/digests. Do not read sealed 2025/26, infer match stadium coordinates or attach synthetic city-reference weather as a real match feature. Missing model coverage for one reference date does not prove other provider models or RPL venues are unavailable. All new data stays research-only.

- **External data probes #41690706216 and #41690713868 (2026-11-03):** SStats official catalog HTTP 200 was parser-inconclusive, not proof of absent RPL. A later diagnostic may output only allowlisted envelope types/counts and SHA, NEVER raw provider error text, league identifiers or match records. Open-Meteo Previous Runs yielded 24/24 reference-city previous-day temperature hours, not real stadium weather or a documented unique historical issuance time. Do not train weather or odds features until match/venue/quote times and source rights are independently qualified.

- **Historical RPL enrichment eligibility (2026-11-03):** SStats public API catalog and Open-Meteo Previous Runs one-day forecast sample may be queried only by explicit owner-only bounded workflows, with aggregate-only output and no source records. SStats public site RPL coverage does not prove API per-match season coverage or rights for training; do not assume league IDs from website links. Open-Meteo stitched Historical Forecast, ERA5 reanalysis or actual post-hoc weather must NOT be represented as a prior-day forecast. Previous Runs' 24-hour lead is only a candidate until venue history and forecast timestamp are verified; provider attribution is mandatory. Both probes exclude sealed 2025/26 and must not alter original M2 Poisson study lock, M2 4/8 or M3 prohibition.

- **Real seven-season rich-stat observations (owner protected #41674569785):** first 50 records for each 2018/19–2024/25 season contained **zero observed candidate fields** for stadium/city/surface, weather, coaches, lineups, players, xG, shots and odds. This is a first-page JSON-key test, not proof of absence across all source endpoints. Never fabricate missing fields, infer historical pre-match weather/lineup timestamps or claim same-provider club-name consistency as independent mapping. See `docs/RPL_SEVEN_SEASON_ENRICHMENT_SOURCES.md`; respect source-specific free API rights and $0 limit.

- **RPL club identity continuity observation:** the private source team-ID/name probe may emit only counts, eligibility flags and digests for 2018/19–2024/25. Do not expose raw provider club IDs or names, infer aliases from matching labels alone, or treat one-source consistency as independent club mapping acceptance. Existing M2 Poisson and sealed 2025/26 holdout are strictly out of scope.

- **Private RPL rolling development (2026-11-03):** five fixed season folds F1–F5 (2018/19–2019/20 → 2020/21 through 2018/19–2023/24 → 2024/25) and market H/D/A paired benchmark are pure, synthetic-tested only. Cross-season team IDs require independent validation, bookmaker quote capture must predate the model's midnight UTC cutoff, no odds after cutoff/closing-price leakage, no arbitrary match-day input or 2025/26 data, and all comparisons must count missing matched odds. See `docs/RPL_SEVEN_SEASON_DEVELOPMENT_PROTOCOL.md`. Never declare real model superiority without proper historical evidence and clustered uncertainty.

- The owner-only seven-season historical source import #41668066639 succeeded with 7 private immutable snapshots, 1,680 normalized fixtures and independent RLS/aggregate verification. A separate pure prior-day feature protocol is in docs/RPL_SEVEN_SEASON_TEMPORAL_FEATURES.md; it is NOT a model-training authorization or an amendment to frozen M2. Owner-approved 2018/19–2024/25 source-only private archive must only be written through the protected, exact-confirmation zero-cost API workflow. Use the isolated private history tables with FORCE RLS, full 240/16×30 validation, canonical hashes, and no raw provider rows in GitHub artifacts/logs. Never use archived source data to retune the frozen M2 2024/25 Poisson baseline or access 2025/26 sealed results before a separately approved pre-holdout lock.

- **Owner strategic goal, 2026-11-03:** personal, noncommercial RPL probabilistic modelling with a candidate seven-season 2018/19–2024/25 development horizon, optional eventual private-only access and honest comparisons to bookmaker market probabilities. Public usage or monetization is not mandatory. First verify sample/source coverage without opening 2025/26, then preregister a separate multi-season protocol; do not retune the existing M2 independent-Poisson baseline or silently change M2/M3 acceptance. See `docs/RPL_PRIVATE_RESEARCH_STRATEGY.md`.

- **M1 ACCEPTED 2026-11-02** by explicit owner decision ([closed #124](https://github.com/StanleyLl0yd/FootballForecast/issues/124)) following two distinct complete internal 232/232 repository-wide technical reviews, exact-main CI/Security/CodeQL and Frankfurt Vercel verification. **M2 OPEN, authorized by owner 2026-11-02** ([#182](https://github.com/StanleyLl0yd/FootballForecast/issues/182)); statistical research implementation is authorized, but **public forecast publication and production-trained models are not yet enabled**. Always follow the pre-registered [M2 baseline protocol](docs/M2_BASELINE_PROTOCOL.md), isolate the sealed 2025/26 holdout from all fit/tuning, and label retrospective evaluation without publisher pre-match snapshots as non-strict. **M3 is not authorized**. M0 was accepted on 2026-10-29. Historical attributed Footbolno snapshots remain immutable, and all M0 archival Footbolno network probes plus routine M1 scheduled/push fetch-and-refresh are manual-only since the 2026-11-03 owner decision; no automatic Footbolno download may be reintroduced without explicit approval; the new OpenFootball CC0 train-only study is [separately preregistered](docs/M2_OPENFOOTBALL_PROTOCOL.md) with calendar-only inputs, no fake UTC kickoff, no Footbolno dependency and a sealed holdout; never claim approved or retained trained models, measured accuracy or historical pre-match availability; temporary train-only fits are documented separately.
- Browser-first, **public read-only** football analytics: anonymous visitors can SELECT only the six approved non-personal catalog, match and forecast tables. Keep source rights, provider raw records and access grants private. `/admin` remains deny-by-default and has no enabled mutation endpoints; optional GitHub owner-only login may be configured later using a stable provider ID. Preserve least-privilege RLS and never expose service-role credentials in clients, Git, logs, tests or artifacts.
- Keep Python mathematical/data-processing logic independent of Next.js, and expensive training outside web HTTP requests. Future job dispatch must enforce authorization, allowlisted operations, resource bounds and authenticated worker results; don't activate unfinished endpoints.
- **Owner decision, 2026-10-19: strictly zero-cost football sources and infrastructure.** No data purchases, subscriptions, paid APIs, paid tier upgrades, paid provider fallback, trial-to-paid conversion, credit card/billing enrollment or automated spend. This is not a request to propose paid plans: if a zero-cost source becomes unavailable or insufficient, mark the dataset unavailable and use another verified free source. Rank *all eligible* free/public sources by field-specific authority, observed accuracy, coverage, freshness, original provenance and legally permitted use. Do not equate many agreeing mirrors with independent evidence. `docs/M0_FREE_SOURCE_REGISTRY.json` is the machine-readable allowlist and all entries remain inactive at M0.
- **Superseding owner decision, 2026-10-29:** the owner explicitly authorizes use of all 20 cataloged free data sources in the ways their published terms allow. Do not require provider reply letters, separate case-by-case owner approval or speculative proof of every upstream right before routine work. Implement licensed Footbolno CC BY 4.0 data ingestion/analysis with attribution; use OpenFootball CC0 and other eligible free sources for comparison; use SportScore's documented free API within its quota/attribution/reuse conditions. Where a particular site's terms prohibit automated bulk extraction, use it only as a manual reference or choose another permitted feed. Historical as-of and empirical accuracy are data quality, not an assumed retroactive publication timestamp. No paid services.
- **Owner decision, 2026-10-20:** minimum RPL pilot is 2024/25 fixed-baseline training, 2025/26 sealed test, 2026/27 current fixtures (`docs/M0_MINIMUM_RPL_SCOPE.json`). Seasons before 2024/25 are optional for M0. No relaxation of licensing, match-level truth, timestamp provenance or approved-use requirements. Do not train on unapproved data, tune on a sealed test or claim independent calibration from two completed seasons.
- **Owner decision, 2026-10-22 (dev-only dependency risk):** accept only the tracked dev-only `braces@3.0.3` advisory `GHSA-vfj7-8cjw-p6xm` while strictly isolated to the reviewed dev-only dependency chain. Preserve production audit, complete exception validator, Gitleaks, CodeQL and Dependabot. This is a non-gating accepted risk under #8, not an actual vulnerability fix.
- **Owner decision, 2026-10-22 (M0 reachability):** one actual Russian wired/home no-VPN 3/3 HTTP PASS sufficed for M0. Two Russian mobile carrier failures remain real, documented and non-gating under #6. Do not claim successful mobile reachability.
- **Owner decision, 2026-10-22:** accept the documented residual risk of losing the near-empty Supabase Free database. M0's recovery acceptance is application-schema migration replay from GitHub, checked-in non-secret deployment configuration and explicit risk documentation. No production data backup/restore has been demonstrated; defer the **decision** to build real encrypted offsite backup/recovery until FootballForecast is fully functional (#96). Do **not** gate M0/M1 on backup, claim production recoverability, expose credentials or enable paid backup infrastructure.
- Respect `docs/DATA_SOURCES.md` and `docs/LICENSING.md`: a public page is not a data license. No unauthorized scraping, bulk reuse or redistribution; treat all external records as untrusted, preserve provenance and provider-specific semantics.
- Preserve event/publication/ingestion/as-of timestamps and strict temporal separation in feature engineering and backtesting. Never train or score historical predictions with future information, retroactively corrected observations without evidence, or hidden test-set tuning.
- Keep prediction publication append-only, versioned and reproducible. Do not silently alter forecasts or outcomes, model/dataset fingerprints, calibration states or scoring conventions. Treat SQL migrations and API/JSON schemas as compatibility-sensitive contracts.
- Do not invent football predictions, statistical quality, calibration results, benchmark measurements, data-provider approval, integration status or tests. State sample sizes and uncertainty; prioritize correctness over appearing predictive.
- Do not change milestones, create production costs, expose private endpoints or pick a source-code license without the owner's approval. Use numerical product versions; no alpha/beta labels.

## Mandatory repository-wide audit and deep-refactoring protocol

When the owner explicitly requests a **full audit, security audit, code review, full cleanup/optimization/simplification, or complete/deep refactoring of this project or repository**, the rules in this section are mandatory. A scoped change or targeted review stays scoped unless the owner requests complete coverage.

A repository-wide audit is an implementation task, not merely a request for recommendations.

### Objective

Audit the entire repository and reduce the codebase to the minimum necessary complexity while preserving 100% of its current functionality and externally observable behavior.

The refactored project must preserve, unless an explicitly requested bug fix requires otherwise:

- user-facing functionality;
- application behavior;
- UI/UX;
- football analytics, model and business logic;
- public APIs and contracts;
- persisted and exchanged data formats;
- platform-specific behavior;
- documented capabilities;
- edge-case semantics.

The goal is minimum **necessary complexity**, not minimum line count.

Do not perform code golf.

A change is justified only when it objectively reduces one or more of:

- code volume;
- duplication;
- conceptual complexity;
- branching or state;
- coupling;
- maintenance burden;
- dependency surface;
- runtime cost;
- regression risk.

If a change merely makes the implementation different without making it demonstrably smaller, simpler, safer, clearer, or more efficient, leave the code unchanged.

Default decision rule:

- if code is proven unnecessary, delete it;
- if code can be objectively simplified, simplify it;
- if duplicate responsibilities can be safely consolidated, consolidate them;
- if an abstraction no longer provides value, remove it;
- if the benefit is uncertain, preserve the existing working behavior.

### Required audit scope

Before making repository-wide refactoring changes, inspect the complete repository rather than only recently changed files or obvious hotspots.

Review all relevant areas, including:

- production source code;
- tests and test utilities;
- resources and assets;
- configuration files;
- build scripts and build configuration;
- CI/CD workflows;
- release tooling;
- dependencies and development dependencies;
- static-analysis and security configuration;
- documentation;
- platform-specific integration;
- generated-code integration points;
- directory and module structure.

First establish:

1. the actual architecture;
2. authoritative sources of state and business logic;
3. all current user-visible functionality;
4. important internal behavior and contracts;
5. persistence and compatibility requirements;
6. framework-, build-, platform-, or convention-driven entry points.

Only then begin removing or consolidating code.

### Required removal candidates

Actively search for and remove, when proven safe:

- dead code;
- unreachable code;
- unused functions;
- unused classes;
- unused methods;
- unused variables;
- unused constants;
- unused types;
- unused interfaces;
- unused imports and exports;
- unused files;
- unused resources and assets;
- obsolete legacy code that no longer participates in current behavior;
- temporary workarounds whose original constraint no longer exists;
- duplicate or near-duplicate implementations;
- unnecessary abstraction layers;
- unnecessary wrappers;
- unnecessary helper functions;
- adapter chains that add no meaningful semantics;
- redundant data conversions;
- redundant intermediate objects;
- redundant intermediate state;
- redundant copies and transformations;
- defensive checks for states already guaranteed by types, architecture, invariants, or earlier validation;
- repeated validation of already validated data;
- repeated checks of the same condition;
- redundant fallbacks;
- obsolete compatibility branches;
- unused feature flags;
- obsolete configuration options;
- unused dependencies;
- unused development dependencies;
- duplicate-purpose dependencies;
- commented-out historical code;
- stale TODO/FIXME items;
- leftovers from previous migrations or refactors.

Pay particular attention to patterns such as:

- repeated null/state/bounds checks;
- nested checks of the same condition;
- repeated validation across adjacent layers;
- unnecessary `try/catch` blocks;
- wrapper -> wrapper -> wrapper call chains;
- DTO/model conversion chains;
- multiple representations of the same authoritative state;
- temporary states that duplicate existing state;
- compatibility paths left behind after migrations;
- helpers with only one trivial caller;
- abstractions created for future scenarios that never materialized.

### Proving code is unused

Do not classify code as unused solely because a textual search finds no direct call.

Before removing anything, check for indirect or convention-driven use through:

- callbacks;
- events;
- observers;
- dependency injection;
- reflection;
- dynamic loading;
- serialization/deserialization;
- framework conventions;
- lifecycle hooks;
- manifests;
- resources;
- routing;
- configuration;
- generated code;
- build scripts;
- CI/CD;
- release tooling;
- plugins;
- native/platform integration;
- test or debug tooling;
- external/public contracts.

When uncertainty remains, preserve the code until its lack of use can be demonstrated.

### Required simplification review

Look for opportunities to safely:

- shorten code without reducing readability;
- simplify control flow;
- reduce nesting;
- reduce mutable state;
- reduce the number of branches;
- merge equivalent paths;
- merge components with the same responsibility;
- remove unnecessary temporary values;
- remove unnecessary objects and allocations;
- remove redundant copies;
- remove repeated transformations;
- remove redundant loops or passes over the same data;
- compute invariant values once instead of repeatedly;
- replace custom code with standard language, platform, framework, or library facilities when clearly simpler;
- eliminate repeated business logic;
- centralize genuinely shared logic when doing so reduces total code and conceptual complexity;
- reduce coupling;
- remove premature generalization;
- remove architecture that exists only for hypothetical future requirements.

Do not introduce an abstraction merely to satisfy DRY.

Similar-looking code should only be unified when the resulting abstraction reduces real duplication and overall complexity.

### Architecture review

Explicitly determine whether:

- historical layers are still necessary;
- historical components are still necessary;
- abstractions are disproportionate to the actual problem;
- interfaces exist with only one implementation and no meaningful boundary benefit;
- classes or modules can be safely merged;
- classes or modules can be safely deleted;
- responsibilities are unnecessarily fragmented;
- there is premature generalization;
- there is speculative extensibility;
- infrastructure exists only for hypothetical future features;
- current architecture reflects requirements that no longer exist;
- duplicated state or business logic creates unnecessary coupling;
- implementation complexity is proportional to actual product complexity.

Prefer the simplest architecture that fully supports the current product.

Do not perform a large rewrite merely because another architecture appears cleaner, newer, or more fashionable.

### Performance review

Review performance only where there is practical value.

Look for:

- repeated calculations;
- repeated queries;
- repeated reads;
- unnecessary parsing;
- repeated transformations of unchanged data;
- avoidable allocations;
- unnecessary copies;
- redundant loops;
- multiple passes that can safely become one;
- unnecessary render/re-render/rebuild/recompute work;
- inappropriate data structures for actual access patterns;
- invariant operations performed repeatedly instead of once;
- unnecessary work in frequently executed paths.

Do not introduce micro-optimizations that reduce readability or maintainability without an obvious or measurable benefit.

### Dependency review

Review every production and development dependency.

For each dependency:

- verify that it is actually used;
- verify that its purpose is still required;
- remove unused dependencies;
- remove obsolete dependencies;
- identify multiple libraries serving the same purpose;
- consolidate overlapping dependencies where safe;
- prefer standard language/platform/framework functionality when it clearly replaces a dependency with less total complexity.

A dependency may be replaced by a small local implementation only when doing so clearly reduces overall complexity, risk, maintenance cost, or artifact size.

Do not replace a mature, well-maintained library with custom code merely to reduce the dependency count.

### Non-negotiable behavior-preservation rules

Unless explicitly requested, a repository-wide cleanup or refactor must not intentionally:

- remove user-facing functionality;
- change existing UX;
- change visual behavior;
- change business logic;
- change forecast/model semantics;
- change public APIs;
- change public contracts;
- change persisted data formats;
- change exchanged data formats;
- change edge-case behavior;
- change platform behavior;
- weaken compatibility;
- weaken accessibility;
- weaken security or privacy controls;
- reduce functionality merely to reduce code size;
- add unrelated functionality;
- introduce new architectural layers only to satisfy generic best practices;
- perform a broad rewrite without a demonstrated need.

Repository-specific invariants defined elsewhere in this file remain mandatory throughout the refactor.

### Required execution workflow

For a repository-wide audit or deep refactor:

1. Inspect the entire repository.

2. Establish the current:
   - architecture;
   - feature set;
   - user-visible behavior;
   - internal contracts;
   - authoritative state;
   - persistence behavior;
   - platform constraints.

3. Collect reliable baseline statistics where practical.

4. Build an internal candidate list grouped into:
   - deletion;
   - consolidation;
   - simplification;
   - architecture reduction;
   - dependency cleanup;
   - practical performance optimization.

5. Validate every removal against both direct and indirect usage.

6. Rank candidates by:
   - confidence;
   - regression risk;
   - complexity reduction;
   - maintenance benefit.

7. Apply changes in small, logically coherent groups rather than as one uncontrolled rewrite.

8. After every meaningful group, run the relevant available checks, such as:
   - unit tests;
   - integration tests;
   - regression tests;
   - lint;
   - formatting checks;
   - type checking;
   - compilation;
   - build;
   - static analysis;
   - dependency/security checks;
   - project-specific validation.

9. If critical behavior lacks sufficient test coverage for a contemplated risky change, first add the minimum regression test required to capture the existing behavior.

10. Keep behavior-preserving refactoring separate from unrelated feature development.

11. When a candidate cannot be proven safe, leave it unchanged and record the reason.

12. Complete the first refactoring pass.

13. Perform a mandatory second full pass over the already-refactored repository.

14. During the second pass, look again for:
   - newly exposed simplification opportunities;
   - remaining dead code;
   - residual duplication;
   - unnecessary abstractions;
   - unnecessary wrappers;
   - redundant checks;
   - unused dependencies;
   - residual legacy;
   - temporary structures made obsolete by the first pass.

15. Finish with the complete available project verification suite.

### Validation requirements

The final verification should include every applicable repository check.

Examples include:

- clean build;
- complete unit-test suite;
- integration tests;
- regression tests;
- lint;
- formatting verification;
- type checking;
- static analysis;
- dependency audit;
- security checks;
- platform-specific builds;
- production build;
- project-specific verification scripts.

Do not claim a check passed unless it was actually executed successfully.

If a check cannot be run because of environment, credentials, hardware, platform, unavailable tooling, or another external limitation, state that explicitly.

### Comments during refactoring

Preserve the repository's comment policy.

As a default:

- keep comments to the minimum necessary;
- keep source-code comments in English;
- remove stale comments;
- remove misleading comments;
- remove redundant comments;
- do not add comments that merely narrate obvious code;
- retain comments that explain a non-obvious reason, constraint, workaround, invariant, compatibility requirement, or important contract.

Do not replace clear code with explanatory comments when the code itself can be made self-explanatory.

### Completion standard

A repository-wide audit/refactoring task is not complete merely because:

- code was formatted;
- static analysis was run;
- recommendations were listed;
- potential improvements were described;
- only recently modified files were reviewed.

Safe and justified improvements must be implemented directly.

The final codebase should be objectively smaller, simpler, less duplicated, less coupled, easier to reason about, or easier to maintain while preserving behavior.

### Required final report

At completion, report:

1. **Removed**
   - dead code;
   - unused files/resources;
   - obsolete compatibility code;
   - unnecessary abstractions;
   - other removed components.

2. **Consolidated**
   - duplicated logic;
   - equivalent components;
   - repeated validation;
   - shared responsibilities.

3. **Simplified**
   - control flow;
   - state;
   - architecture;
   - transformations;
   - hot paths.

4. **Dependencies**
   - dependencies removed;
   - duplicate-purpose dependencies consolidated;
   - dependency changes intentionally not made and why.

5. **Legacy**
   - legacy components found;
   - which were removed;
   - which remain and why.

6. **Intentionally unchanged**
   - candidates reviewed but preserved;
   - reason removal or simplification could not be proven safe.

7. **Verification**
   - tests run;
   - builds run;
   - lint/typecheck/static-analysis/security checks run;
   - their results.

8. **Limitations**
   - areas that could not be safely optimized;
   - missing coverage;
   - unavailable environment/tooling;
   - external constraints.

9. **Before/after statistics**, when they can be measured reliably:
   - file count;
   - source line count;
   - dependency count;
   - test count;
   - production/build artifact size;
   - other project-relevant metrics.

Never invent statistics.

Use the same counting method for before and after values.

### Final principle

When choosing between:

- preserving working code whose necessity is uncertain;
- deleting code because it appears unnecessary;

preserve the working behavior until the code is proven unnecessary.

The final goal is a codebase containing only the complexity required to implement the project's current functionality: as small, clean, understandable, maintainable, and efficient as reasonably possible, without functional regressions.

## Mandatory milestone exit gate (M0 and every subsequent M stage)

Before declaring milestone M0, M1, M2, or any later M stage complete or starting work that assumes it has passed:

1. Use a single existing milestone exit issue if present, otherwise create one when exit work actually begins; do not manufacture milestone issues prematurely.
2. Perform a **full repository-wide audit, safe refactoring and security/code review** using **both full passes** in the protocol above, even when recent PRs were individually checked. This includes source, tests, configuration, CI, dependencies, database migrations, auth/RLS, contracts, data provenance and source rights as applicable.
3. Fix demonstrated defects and implement every safe, justified reduction in necessary complexity. Preserve uncertain code and document why; keep functional changes separate.
4. Run the full applicable end-of-milestone verification: Python tests/type/static checks, TypeScript lint/typecheck/production build, security/dependency scans, migration and RLS negative tests, auth and browser integration, temporal-integrity and probabilistic regression tests, and relevant deployed smoke checks **when those components exist**. Missing external infrastructure or credentials are blockers, not passing tests.
5. Record findings, implemented changes, deliberate non-changes, measured before/after metrics, exact PR/commit SHAs, exact-head and post-merge checks, residual risk and skipped checks in durable `docs/` evidence linked from the exit issue.
6. Only then close that issue and mark the milestone accepted. A partially functional or privately deployed preview does **not** prove milestone completion.

This gate also applies automatically to future milestones, without requiring another owner reminder. Trigger it at real milestone exit, not on arbitrary dates.

## Execution, reporting and context continuity

- Investigate the repository using structure, manifests, targeted searches and diffs first. Do not repeatedly read unchanged files or rerun expensive unchanged suites; run focused checks before broader suites, except at mandatory full-audit and milestone exit.
- After each substantive completed implementation pass, synchronize code, relevant `docs/`, `ROADMAP.md` and existing issues via **one appropriately scoped PR**. An issue comment alone does not substitute for durable repository state. Keep README a concise public landing page.
- When continuing, resume from current confirmed commit/PR/checks; don't invent new branches or restart verified work. Preserve unresolved blockers and status accurately.
- In long conversations, provide a compact `HANDOFF FOR NEW CHAT` covering authoritative main SHA, active milestone, changed files, current PR/issues, exact-head/main CI, blockers and next actions, without private reasoning or duplicated history.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [ROADMAP.md](ROADMAP.md) and [data-source policy](docs/DATA_SOURCES.md).

## Source-use clarification (owner, 2026-10-29)

The owner expressly approves usage of genuinely free FootballForecast data sources within their published terms and accepts the documented third-party provenance uncertainty. See [M0 exit/source decision](docs/M0_EXIT_AUDIT_AND_SOURCE_DECISION.md). This authorizes already implemented attributed, bounded browser previews, publisher-licensed Footbolno CSV/JSON research, CC0 OpenFootball corroboration, and free SportScore derived/display API use with its visible dofollow attribution. It **does not** grant rights belonging to third-party publishers, authorize prohibited automatic extraction, free-tier evasion, unlicensed bulk mirroring, or claim authenticated historical prematch snapshots. M0 was accepted after full exit verification. M1 may implement permitted free-source acquisition, private retention and model learning without repeatedly seeking blanket upstream permission letters. Preserve source identifiers, retrieval timestamps, attribution, explicit per-provider limits, source status validation and strict separation of train/holdout/prospective predictions. Do not invent archived pre-kickoff facts or treat website-specific extraction bans as waived by the owner.

## M2 rights and private model escrow (2026-11-03)

The authenticated OpenFoot RPL 2026/27 catalog identifies **FotMob** and `Unlicensed-Beta`; do **not** automatically ingest/redistribute or approve production source rights based on owner-approved factual-data wording. Use OpenFoot only for bounded, non-promoting research until upstream authority is demonstrable. The separate protected OpenFootball 2024/25 CC0 model escrow is **train-only**, writes canonical coefficients only to private append-only Supabase, emits digest-only GitHub evidence, and must never read 2025/26 labels, publish forecasts, or assert approved study locks. M2 stays OPEN 4/8; M3 forbidden.

### Live protected escrow receipt (2026-11-03)

Main `a89c82ed02b1157ca935c573f25c93544ba299f1` and protected owner run #41639171388 have independently verified a **real** private, immutable OpenFootball CC0 2024/25 Poisson coefficient artifact in Frankfurt Supabase (`TRAIN_ONLY_UNAPPROVED`, 1447 bytes, SHA-256 `5d1893ac2d3e632f979b1ec67ed751edfa38733b9faf6371fc3f5e24b97fa28d`). Keep actual bytes strictly in `ff_private.ff_m2_training_model_escrow`; only aggregate SHA receipt may be committed to Git / displayed after owner auth. This does not unlock 2025/26, prove historical prematch availability or authorize production forecasts. M2 4/8 OPEN, M3 forbidden.
