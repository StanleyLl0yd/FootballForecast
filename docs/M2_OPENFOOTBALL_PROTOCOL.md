# M2 OpenFootball-first calendar-only train experiment — frozen before first run

**Pre-registered 2026-11-03.** Owner directed FootballForecast to proceed without
Footbolno as a required source. This is a **separate research protocol**
`m2-openfootball-calendar-v1`; it does not retroactively rewrite the
`m2-independent-poisson-v1` source-specific study, reuse an approved model,
or change the original 2025/26 sealed holdout. M2 #182 remains OPEN, 4/8;
M3 and production prediction publication remain unauthorized.

## Source identity and eligibility

- **Only input:** OpenFootball `openfootball/europe` CC0-1.0, exact Git
  commit `63df627f3c87ce71708f016522ea236cf74332c3`,
  file `russia/2024-25_ru1.txt`, Git blob
  `6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc`.
  Verify the raw Git blob **before** any parse; record raw SHA-256.
- Train cohort: exactly **240 ordinary played, scored, uniquely directed RPL
  2024/25 fixtures**, 16 identifiable teams, 30 rounds / eight games per round,
  30 matches per team; reject awards, duplicates, invalid dates, invalid scores,
  incomplete calendars, ambiguous team identities and source substitutions.
- Original text contains **calendar dates**. No independently authenticated
  kickoff UTC instant, final-whistle instant or pre-match publication revision.
  Keep these fields absent, not inferred from calendar midnight or textual
  local time. This research can fit a full prior-season baseline, **not**
  assert strict point-in-time match or lineup availability.
- Deterministic, train-only irreversible aliases derive from **exact training
  text names** as `S_` + first 20 uppercase hex of
  SHA-256(`openfootball-2024-club:` + name). IDs derive exclusively from the
  ordered names of the directed match. No holdout-aware aliases or fuzzy
  normalization. Same-name ambiguities fail closed.

## Fixed model and reproducibility

- Exactly the already pre-registered `fit_independent_poisson` mathematical
  solver: L2 per-team `2.0`, home-advantage L2 `2.0`, zero-mean effects,
  deterministic optimizer, independent Poisson goal rates, no Elo, Dixon–Coles,
  tuning, calibration or other candidate selection.
- Calendar fixtures are a distinct type with `source_calendar_date: date`,
  **not** `kickoff_at: datetime`. The source calendar day has **no authenticated timezone**, so it is not labeled UTC. Mixing types fails closed. Sort solely by
  original source calendar date + deterministic match identity for reproducibility; never
  fabricate or store a kickoff timestamp.
- A *manual owner-only* protected-main workflow fetches this exact public file,
  checks its raw Git blob, validates the round-robin and fits the model in
  ephemeral RAM. Outputs only fixed allowlisted aggregate counts and SHA-256 of
  source bytes, normalized training rows, aliases and fitted coefficients,
  plus actual Git SHA. Private fixture JSON and model weights are deleted on
  runner teardown. No live database credentials, SQL, provider data writes,
  artifacts, model escrow, public forecast or holdout read.
- A successful research job is **not** model approval, published accuracy,
  immutable study lock or true upstream source independence. Record all
  receipts as `TRAIN_ONLY_UNAPPROVED`.

## Verified temporary train replay — 2026-11-03

Two owner-authored protected-main independent research runs [#41601074078](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41601074078) and [#41601164752](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41601164752) both succeeded at exact code SHA `b7812c531a7284a4db58c34ed77af8adeecf8d1f`. Receipt SHA-256 `381159c8928283c6f3d9a2b75bda4ee53d1b9a41f31184d5cd9a14ec267306b6` matched; 240/16 fixtures, H/D/A 103/65/72, identical source/training/club/model digests. The [aggregate-only recorded evidence](M2_OPENFOOTBALL_TRAIN_REPLAY_EVIDENCE.json) links both job IDs; it does not include source records or trained coefficients. Neither run authenticates historical pre-match availability or grants a model lock. The owner page validates its closed schema and SHA locally on the server **after** `requireOwner()`.

## Real public-source outcome — 2026-11-03

[Protected observation #41613346756](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41613346756) has been recorded as [strict aggregate-only evidence](M2_PUBLIC_SOURCE_OBSERVATION_EVIDENCE.json). OpenFootball pinned training reference: 240/16. OpenFoot public demo: only five records (ten clubs), incomplete 2026/27 coverage. SportScore: zero current-day observed matches on one UTC day, not a proof that no fixtures exist. The HTTP response hashes and job IDs are pinned; the original holdout and model lock gates remain unchanged. The owner-only research interface shows **unapproved** observations, not selectable model inputs.

## One-shot alternative current fixture diagnostic

The same existing M2 manual owner-only source-observation workflow may perform **one** separate public-demo, free OpenFoot API request for RPL 2026/27, using documented competition/season filters. It validates only in-memory response shape/aggregate and prints a SHA; all outcomes, even a synthetic complete 240/16 cohort, are explicitly **UNAPPROVED** for model training, live data replacement, pre-match prediction or publication. The OpenFoot trial neither changes nor supplies independent 2025/26 sealed-holdout labels and does not relax the calendar-only 2024/25 training protocol.

## Sealed holdout and live current-season policy

- **2025/26 remains sealed**. The old Footbolno-derived holdout cannot become a
  substitute training cohort. A separate permitted, pinned and quality-checked
  2025/26 evaluation source, deterministic source-team mapping from the
  training-only aliases, protected immutable real model escrow/lock and
  authenticated single-use scorer must be independently accepted **before**
  any labeled evaluation. A prior source agreement report is not an unsealing
  authorization; do not read/migrate/score holdout as part of this protocol.
- OpenFootball's checked pinned RPL tree has no complete 2025/26 or
  current 2026/27 RPL fixtures. Current-match data must come from a separately
  rights-verified, full-coverage and timestamp-qualified **free** source.
  SportScore's previously documented **one-day diagnostic is not** a production
  ingestion or full-season feed. With no eligible source, return stale/unknown,
  **never invent a fixture, a result, a future kickoff or a forecast**.
- Disable recurring Footbolno fetch/import workflows while retaining immutable
  historical Supabase data, migration history and explicitly manual legacy
  recovery commands. No Footbolno requirement is introduced in the new study.
- $0 only, public pages read-only, owner identity fail-closed; RLS and protected
  branch policies remain intact. M2 full exit still needs all acceptance checks,
  two complete repository-wide audits and explicit owner sign-off.

## Calendar-only private coefficient encoding — preparation, not a study lock (2026-11-03)

The existing strictly canonical, bounded in-memory private model codec now supports
`m2-openfootball-calendar-v1` **only when explicitly selected**. Its fitted-model
SHA-256 must equal the original train-only candidate receipt; the legacy
Footbolno study remains the default and cannot silently load calendar-model
bytes (or vice versa). The same 240/16 training-only alias, 8-KiB canonical
format and coefficient checks apply. Synthetic tests prove round-trip and
cross-protocol refusal without touching any real private records.

This is **not an executed escrow**: no actual fitted coefficient bytes have
been saved, encrypted, uploaded, approved, or compared against independent
protected-run evidence. The study still needs authenticated private storage,
protected Git anchoring, provenance and source qualification, independent
review, and single-use authorization **before** any 2025/26 holdout identity or
label is read. No automatic training or publication has been enabled.

### Separate source eligibility observation (metadata only)

[Football-Data.co.uk Russia](https://football-data.co.uk/russia.php)
advertises a historical CSV and says **2025/26 is its final Russian season**.
However, the project's existing
[source registry](M0_FREE_SOURCE_REGISTRY.json) explicitly classifies
`football-data-uk` as **restricted-reference**: private personal/academic
reference only, no permitted automated project ingestion or ML training.
**It is NOT a qualified 2025/26 evaluation source or a ready-to-use
substitute for the sealed holdout.** No CSV match rows or labels were fetched
or inspected here. Any later changed rights decision would still require
pinned bytes, independent score/status quality checks and a separately
reviewed training-only club mapping before evaluation. It cannot provide
the discontinued 2026/27 league feed.

### Explicit owner-only OpenFoot free Starter coverage audit (2026-11-03)

The existing manual `m2-public-sources-observe.yml` now accepts the optional exact
`openfoot_starter=AUDIT_OPENFOOT_FREE` confirmation. This adds **one** owner-only
authenticated RPL 2026/27 request on protected `main`. The free Starter
API key must be stored as the GitHub repository Actions secret
`OPENFOOT_API_KEY` (never a workflow input, issue comment, commit or browser
setting). Without it the job emits `INCONCLUSIVE_NO_FREE_KEY` and does not
contact OpenFoot. No paid plan, trial, credit card or automatic upgrade is used.

The audit enforces authenticated `starter` plan metadata, a single bounded
response, unique match identities and directed club pairs, 240 fixtures / 16
clubs / 30 per club for structural completeness, UTC kickoff instants,
non-windowed scope and a provider source-license-metadata presence flag.
Only aggregate counters and the provider-response SHA-256 are printed; no
source rows, club IDs, credentials, historical holdout or forecasts are
retained. Even a structurally complete observation stays
`STRUCTURALLY_COMPLETE_UNAPPROVED`: source-level terms, real quality checks,
freshness and historical pre-match provenance must be reviewed separately.
It does not unlock 2025/26 evaluation or production ingestion. The provider's
[free pricing](https://openfootapi.com/pricing) advertises 5000 monthly requests;
its [terms](https://openfootapi.com/terms) permit internal research on lawfully
received data but do not license redistribution of upstream feeds.

### Real $0 Starter observation and exact round audit (2026-11-03)

[Owner-run #41628766870](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41628766870)
confirmed free authenticated OpenFoot Starter access, but returned only 50 finished
RPL 2026/27 fixtures, 16 clubs, 50/50 reported UTC kickoffs, 0 future fixtures
in a **single default-page query** (`PARTIAL_UNAPPROVED`).
Public demo returned five; the run neither proves only 50 games exist nor
approves completeness. Provider OpenAPI 3.1 specifies `limit=50` by default
and restricts cursor continuation to **paid Developer**. No cursor can be
followed by FootballForecast, even when a response offers one.

The separately gated `openfoot_rounds=AUDIT_OPENFOOT_ROUNDS` input in the
*existing* owner-only manual `m2-public-sources-observe.yml` (or exact owner-only issue #182 comment `/m2-openfoot-rounds`) can issue **at
most 30** authenticated Starter requests, one per **documented** `round=1..30`
filter within the free quota. It refuses non-Starter access after request 1,
does not paginate, and stops on HTTP/schema/rights-metadata ambiguity. It
requires the private GitHub Actions secret `OPENFOOT_API_KEY` and emits only
aggregate coverage/status counts and a combined 30-response fingerprint;
provider match identities/rows and credentials are never logged or uploaded.
No key means zero requests. Tests are synthetic-only; this is not a verified
live observation until an owner dispatch actually succeeds.

Even 240 structurally valid directed fixtures across 30 rounds remain
`STRUCTURALLY_COMPLETE_UNAPPROVED`, pending independent score, kickoff,
current freshness, original upstream source licence/attribution and rights
checks. The 2025/26 sealed holdout is untouched; no train/predict writes;
M2 remains 4/8 OPEN; M3 remains unauthorized.

### OpenFoot free team-filter fallback (2026-11-03)

[Owner round-scope run #41631229550](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41631229550)
was explicitly triggered on protected main, but stopped after the first query.
The legacy preflight reported `INCONCLUSIVE_NOT_FREE_STARTER` for a **combined**
condition (tier, number of rows, default window or unavailable metadata);
this is **not evidence that the key became invalid**, because the previous
authenticated one-page test proved Starter. The updated workflow prints safe
numeric first-round scope flags and uses the less misleading
`INCONCLUSIVE_ROUND_ONE_SCOPE_OR_TIER` code.

To distinguish provider coverage from paging, a separate owner-only
`openfoot_teams=AUDIT_OPENFOOT_TEAMS` dispatch or exact owner-authored
issue #182 comment `/m2-openfoot-teams` can perform at most **17**
free Starter requests: one explicit season page, then one documented
`team` filter per **16** source-derived club IDs. IDs remain inside a
private temporary runner directory. The validator refuses non-Starter
tiers, arbitrary club IDs, incorrect team membership, duplicates,
changed identities between the two club views, non-UTC kickoffs,
unexpected pagination and ambiguous scope. A full 240-match union
requires each of 16 clubs to have 30 matches and each match to appear
in both club views. Output is only numerical status counters and a
SHA-256 aggregate of response hashes. There is no paid cursor, model
fit, database write, raw row artifact or holdout access.

This is **pending real execution**, not confirmation of 240 accessible
matches. Source and upstream licence, attribution, temporal provenance,
and independently checked current fixture quality still require
review. M2 stays OPEN 4/8; M3 not authorized.

### Confirmed 2026/27 free feed coverage — source-rights follow-up (2026-11-03)

Owner-protected [run #41632612945](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41632612945)
at `main=9dbdfb5b30936e24af7cb65b064e1e18350d64c4` succeeded:
16 free authenticated Starter club-filter GETs retrieved 480 club views with
240 uniquely cross-confirmed directed Russian Premier League fixtures,
16 teams, 104 finished and 136 scheduled at 12:04:50 UTC, no missing
UTC kickoff fields or limited response windows. License-source metadata
was **present** in all 16 responses but neither its values nor original
upstream redistribution rights were independently reviewed. The only
qualified state is `STRUCTURALLY_COMPLETE_UNAPPROVED`; the source is
**not** an approved production importer and does not unblock a model or
the sealed 2025/26 holdout.

The existing source-observation workflow now offers an independent bounded,
owner-only **authenticated free Starter** `GET /v1/competitions` probe, triggered by
`openfoot_catalog=AUDIT_OPENFOOT_CATALOG` or exact owner-authored issue
#182 comment `/m2-openfoot-catalog`. It logs only the Russian league's
closed-schema source name, claimed licence, HTTPS attribution URL, current
season, source mode and catalog-availability flag; no match rows, club IDs,
API keys or source contents are committed. Unavailable or ambiguous
metadata returns `INCONCLUSIVE`. A catalog attribution/rights claim
must still be checked against upstream terms before any public reuse,
and the independent actual-score/kickoff/freshness audit remains pending.
M2 **4/8 OPEN**, M3 not authorized.

Observed first catalog research [#41634009571](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41634009571) returned `INCONCLUSIVE_HTTP` without a key, **not** an upstream-rights decision. The manual owner-only catalog probe now uses the existing protected free Starter credential, no paid plan and no raw match retention; the authenticated result is not asserted until a real run succeeds.

### FotMob upstream rights and private train-only model escrow — 2026-11-03

Authenticated OpenFoot [catalog research #41635173009](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41635173009),
performed on exact protected main, identified the source of RPL 2026/27
as **FotMob**, claimed licence `Unlicensed-Beta (owner-approved factual data)`,
source `https://www.fotmob.com/`, catalog SHA-256
`5005b1690452aee8538b8a77e530b877368381f164c6b1ceb425a01ae342b42d`.
The provider's declaration of source access is **not** written authorization
from FotMob. [FotMob's own site](https://www.fotmob.com/) disallows systematic
automated use; its [reported explicit removal request](https://github.com/probberechts/soccerdata/issues/918)
also describes unauthorized API retrieval as prohibited. [OpenFoot's terms](https://openfootapi.com/terms)
permit internal research on lawfully obtained records but expressly defer
third-party source reuse obligations. Consequently the app must **not**
automatically ingest, redistribute or promote this OpenFoot/FotMob feed to
production without actual upstream authorization. The verified 240/240
structural RPL result remains useful as *research coverage evidence only*.
This determination does not imply that the observed scores/kickoff times
have been checked against independent authoritative results.

Separately, a new owner-only `OPENFOOTBALL_ESCROW_TRAIN_ONLY` / exact issue
#182 `/m2-openfootball-escrow` research job uses **only** the exact pinned
CC0 OpenFootball 2024/25 240/16 train cohort. It independently refits the
existing fixed independent-Poisson protocol, verifies the canonical 8-KiB
private model format and the prior two protected-run training/model digests,
then inserts at most one immutable copy of private coefficients into
`ff_private.ff_m2_training_model_escrow` on Frankfurt Supabase. PostgreSQL
verifies the byte SHA-256 itself; non-privileged roles and service_role
cannot read or insert, and UPDATE/DELETE/TRUNCATE are rejected. The job uses
the existing protected private research environment, pinned server CA,
no public artifact, no provider rows or model coefficients in logs.

This is **not a holdout-unsealing study lock**. Even successful private
storage and a protected hash receipt leave the 2025/26 sealed labels
untouched and the study `TRAIN_ONLY_UNAPPROVED` until independent source
qualification, approval of an immutable Git-anchored pre-holdout identity,
one-time permitted retrospective evaluation, owner UI acceptance, and
two repository-wide exit audits. M2 remains **4/8 OPEN**, M3 unauthorized.

### Verified real private training-only model escrow (2026-11-03)

Protected [PR #220](https://github.com/StanleyLl0yd/FootballForecast/pull/220)
was merged by guarded squash at main
`a89c82ed02b1157ca935c573f25c93544ba299f1` (exact-head 10/10 PASS,
post-merge exact-main 10/10 PASS, production Frankfurt READY).

Supabase Frankfurt migration `20261103125026_m2_private_openfootball_model_escrow`
is applied. Protected owner [training/escrow run #41639171388](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41639171388)
job `125927962778` **successfully saved one real canonical private model**:
240 scored OpenFootball CC0 2024/25 fixtures/16 clubs,
source SHA-256 `f315f67d49e5f2ed26bb5b2504244f36d37be958b5ccadd1755fb6b71b015dcb`,
fitted-model SHA-256
`987caad53cf77e4977482b4e9750b2c779912b47d0bc884cfb3807e8151ad95d`,
1447 private bytes with byte-artifact SHA-256
`5d1893ac2d3e632f979b1ec67ed751edfa38733b9faf6371fc3f5e24b97fa28d`.
The fitted/source/team/rows digests exactly match two earlier independent
train-only runs #41601074078 and #41601164752. Aggregate receipt SHA-256 is
`2d5a9a9f1d6f682f8bfc7b7c388eb184887b944288beac33080aeb8097d69bc9`.

A separate privileged **read-only** live PostgreSQL query verified 1 private
model, correct SHA-256 of stored bytes, `TRAIN_ONLY_UNAPPROVED`, no holdout
read or model approval. Table has FORCE RLS, denies
`anon/authenticated/service_role` reads/writes and has both immutable
mutation triggers. Only the aggregate/digest evidence, **not coefficients or
match rows**, is anchored in Git by the protected review of
`M2_OPENFOOTBALL_PRIVATE_ESCROW_EVIDENCE.json`. This is a provenance record,
**not** independently approved pre-holdout study lock. Sealed 2025/26
evaluation and forecast publication remain forbidden. M2 stays **4/8 OPEN**;
M3 unauthorized.

## Source-independent 2025/26 evaluation contract — 2026-11-05 (preparation only)

The pure module `ml/src/football_forecast/research/openfootball_evaluate.py` prepares the **existing fixed OpenFootball calendar Poisson model** for a future, owner-authorized, **non-strict retrospective** single-use evaluation. It is separate from the historical source-specific `m2-independent-poisson-v1` evaluator, which cannot bind an independently sourced 2025/26 cohort to a distinct source SHA. The new module has no network, database, filesystem, training, artifact or publication path.

- A separately reviewed protected **pre-holdout lock** must pin the actual train-only escrow model SHA, canonical private artifact SHA, training rows/source/code and immutable 2025/26 holdout source/snapshot/crosswalk commitments. The train and holdout source SHA **must differ**. The pure `CalendarStudyLock` is only an in-memory data shape: constructing or validating it **cannot authorize** a holdout read.
- A trusted one-use runner must verify the *real* protected immutable lock, permissions and source-specific terms, 2025/26 source bytes, protected read-only permissions, and a crosswalk fixed independently of heldout scores **before reading labels**. The runner and a qualified independent result source are **not yet implemented/approved**. No score may be generated from real 2025/26 labels yet.
- Synthetic-only tests exercise 240 directed fixtures, strict played-vs-awarded semantics, UTC kickoff bounds, 16-club 15-home/15-away structure, unique identities, source/snapshot/crosswalk commitment mismatch, model escrow digest mismatch and deterministic H/D/A Log Loss/Brier/RPS with training-only H/D/A prior **103/65/72**. Unseen/promoted clubs abstain and are counted; no strengths are inferred from 2025/26 labels.
- This is not a pre-match-as-of authenticated walk-forward, a calibrated model, an approved training pipeline, a superior-to-bookmaker claim, or M3 authorization. The previous seven private immutable development snapshots, 2024/25 model escrow, and sealed 2025/26 holdout remain unchanged. **M2 is 5/8 OPEN.**

### Owner data-use direction, 2026-11-05

The owner explicitly permits using all **already accumulated historical datasets** for private model training and retrospective research, subject to actual third-party source permissions and keeping the frozen 2025/26 control cohort independent for its **first** M2 evaluation. This permission does **not** allow silently reclassifying a provider license, training on the sealed holdout before the fixed-model test, using heldout labels for aliases/hyperparameters, source redistribution, production forecast publication, or paid upgrades. Later seven-season experiments must be separately preregistered and evaluated on a genuinely independent cohort.

## Immutable train-derived team crosswalk preparation — 2026-11-05

The pure module `ml/src/football_forecast/research/openfootball_crosswalk.py`
constructs a **candidate only** from: (1) the 16 trusted 2024/25 training-source
team IDs, (2) the exact 16 pinned OpenFootball 2024/25 club strings, (3) an
independently reviewed bijective mapping between those **training-only** identities,
(4) a separately sourced **pre-results** fixed 2025/26 16-club roster-ID list, and
(5) the already fixed model's 16 hashed `S_` aliases. It refuses unknown names,
duplicate/reassigned training identities, invalid source IDs, inconsistent
model identities and incomplete rosters.

The crosswalk maps the 2024/25 incumbents onto model aliases, gives genuinely
unseen roster IDs deterministic `U_` aliases that the fixed model must abstain
on, and rejects IDs outside the frozen roster. It returns private mappings
in memory, while its public receipt contains **only** the deterministic
crosswalk SHA-256, counts and explicit `independentlyApproved=false`,
`studyLockApproved=false` and `holdoutRead=false` flags. No source IDs,
club names, fixture rows, provider secrets, heldout outcomes or coefficients
may appear in public artifacts.

**Limits:** The pure helper cannot authenticate where input roster/team IDs
originated or certify that a manual correspondence is correct. In particular,
a predeclared roster input MUST come from independently documented prior metadata
and not from unsealing score-bearing 2025/26 rows. A future protected operator
must review and freeze the actual source/rights, old 2024 training-to-provider
mapping, roster identity, code and model artifacts **before** any label read.
The current module does not access a database, build a real manifest or grant
single-use evaluation permission. The earlier private snapshot registry remains
unchanged. M2 stays **5/8 OPEN**, M3 prohibited.
