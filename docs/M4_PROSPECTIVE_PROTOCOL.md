# M4 — private prospective RPL shadow protocol (v1, 2026-11-11)

**Status: M4 OPEN, [#304](https://github.com/StanleyLl0yd/FootballForecast/issues/304); A1–A8 independent gates.** The owner authorized beginning M4 after accepting [M3 #271](https://github.com/StanleyLl0yd/FootballForecast/issues/271) 8/8. **No public forecasts are authorized.** This initial PR adds a pure testable guard and documentation, not a real model lock, database migration, source fetch, timed workflow or forecast publication.

## Science and fixed inputs

M3 has 1,680/1,680 retrospective public/private fixture correspondences, 1,673 candidate played labels after excluding six technical awards and a revised official score, and five chronological development validation folds with 1,197 scored candidates. This is **NON_STRICT_RETROSPECTIVE**, not historical original first-publication evidence or independent sealed test performance. Never re-fetch, re-query, re-score, tune, publish or reuse the **consumed 2025/26 holdout**, even if a current external API returns it.

Start M4 only with genuinely **future 2026/27 RPL fixtures**, frozen model provenance based solely on eligible 2018/19–2024/25 development data, and new *trusted server-time* source observations **after 2026-11-11T11:04:56Z** (M4 issue creation). No retrospective “forecasts” for matches already completed by M4's start; no backdating historical receipt timestamps. The first candidate requires at least **900 seconds (15 minutes)** of actual lead before kickoff.

## Private shadow pipeline, sequential gates

1. **A1** freeze this scope, 2025/26 denial, versioned source/model/fixture contracts and honest monitoring.
2. **A2** pure source-free preflight with canonical seconds-precision UTC, explicit 2026/27 only, unique directed identity, unrevised scheduled fixture, source revision/kickoff evidence/identity SHA-256 and monotone observation/capture/evaluation time. Strictly deny awarded, revised, missing, ambiguous, stale or past fixtures.
3. **A3** protected owner-only candidate training/locking with immutable model manifest, digest and approved historical cohort. Do not tune using 2026/27 observed outcomes or the 2025/26 holdout. The fixed M3 Poisson is a candidate, not automatically a production-approved model.
4. **A4** add a privately protected **append-only**, idempotent forecast/revision/abstention ledger; no public SELECT or write privilege. Test PG17 RLS, transaction concurrency, first-write timestamps, revision lineage and denial of status mutation.
5. **A5** actual forward-time capture before kickoffs using server-controlled UTC and independently verified kickoff/club mapping/source revision, plus bounded owner-only job. No browser-initiated privileged work until auth, CSRF, rate/replay, one-use idempotency and negative user-role tests are reviewed. No public forecast worker.
6. **A6** settle outcomes only after independent *played* results and real post-match availability; maintain calibration, coverage/abstention, Log Loss/Brier/RPS, matching baseline and uncertainty. A completed game with no earlier immutable forecast must never enter scored forecast coverage.
7. **A7** owner-only monitoring, match revisions and Zenit pre/post-match reports only for applicable RPL fixtures; no user-visible published forecast.
8. **A8** two complete repository-wide audits, live RLS/auth/browser, exact-main CI/Security/CodeQL and Vercel release integrity, with owner acceptance. **Publishing still requires a separate explicit authorization.**


## A2 signed metadata preflight (synthetic proof, no real capture)

`apps/web/lib/m4-signed-metadata.mjs` adds **two independent domain-separated HMAC-SHA256 attestations** on top of the A1 structural preflight: an owner-controlled source observation and a separately configured independent kickoff corroboration. Each signer binds the exact prospective fixture identity, UTC kickoff, relevant evidence digests and its own observed/recorded UTC times. The two issuer IDs, signing keys, source IDs and canonical signed fields must remain distinct; extra fields, unknown seasons, mismatched fixture IDs, swapped clubs, stale/tampered signatures, backdating and missing/out-of-order timestamps fail closed. All metadata is synthetic in tests.

A valid test returns `authenticated_candidate_only`, **not** `genuineAsOfAttested`, `modelApproved`, `writeAuthorized` or `publicationAuthorized`. HMAC proves only that a configured issuer attested a string; it cannot prove the server's real clock, which third party supplied a kickoff, that independent data sources are truly independent, or append-only actual source capture. Such verification and storage must be established in A5 with live, independently reviewed evidence. The private signing secrets must be provided solely by reviewed, protected server-side code; never by a browser, source API or untrusted request. No keys are committed. This is a **pure, no-I/O verifier**, not an API or source collection workflow.

## A3 owner-only candidate preparation (pending actual protected execution)

`ml/src/football_forecast/research/m4_private_candidate.py` contains the frozen fixed-parameter **M3 Poisson shrinkage** aggregate model in a new private-only artifact format. It requires exactly **1,673 eligible development candidates** across seven season counts `[240,236,238,240,239,240,240]`, exactly **26 seven-year club IDs**, previously reviewed club/fixture/date chronology, no unplayed labels, no future-season input and a seven-snapshot source manifest. Serializes canonical immutable model bytes and two source/row hashes, with `SHADOW_CANDIDATE_UNAPPROVED`, `productionApproved:false`, `publicForecastsAuthorized:false`, `holdout2025_26Read:false`. Unknown/unmapped clubs **ABSTAIN**. Synthetic tests check deterministic input permutation, hash sensitivity, source-identity rejection and no future/holdout leakage.

`.github/workflows/m4-owner-model-candidate.yml` provides an exact-owner protected-main **manual SELECT-only** PostgreSQL 17 execution against already stored 2018/19–2024/25 private snapshots. It validates the complete 1,680-row topology and the seven M3 independently corroborated technical/revision exclusions before fitting in volatile memory. Only SHA-256 digests and fixed counts may appear in the bounded receipt; neither individual scores, private club IDs nor model bytes leave the protected job. No API, publication, schema mutation or persisted model artifact is introduced by this step. The workflow needs a real owner-triggered SUCCESS and consistent receipt to advance A3; **the artifact cannot yet be used for a live prediction or claimed as an approved operational model**. A4 still needs a reviewed private immutable ledger/model storage and PG17 RLS tests.

## A3 protected candidate read-only result and private model escrow

The first real protected read-only run [#43016882120](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/43016882120) returned the frozen private candidate SHA-256 `b3eeb4cf950c38507572c6c6b4e3db7f133cf7cc2ee0593b2d940c66394b0a0c` after the fixed **1,673 of 1,680** development-only cohort and seven explicit exclusions. It did not expose source rows, private club mappings, model coefficients or 2025/26.

A separate protected owner command, `/m4-model-store-private` on issue #304, explicitly authorizes **only one immutable `ff_private.ff_m4_candidate_models` candidate write**. The workflow uses the existing pinned Supabase TLS CA, strong owner identity, exact protected main SHA, bounded output, and a run-specific database transaction. It refuses *any* artifact whose freshly calculated SHA does not equal that **previously observed fixed SHA**. INSERT uses `ON CONFLICT (model_sha256) DO NOTHING`, then rechecks private stored digests, provenance, bytes length and all three false approval/holdout flags; duplicate runs cannot mutate model rows. The read-only command remains separately available. The model's state is `SHADOW_CANDIDATE_UNAPPROVED`, not permission to predict or publish. **Never print or upload `model_bytes` or private source rows.** The owner-run SUCCESS and live Supabase catalog verification are required before claiming the escrow is populated or accepting A3.

## A4 private append-only storage (schema under review)

Source-controlled `database/migrations/0015_m4_private_shadow_ledger.sql` introduces **three exclusively `ff_private` tables**: model artifact bytes with SHA integrity and seven-year/1,673-row provenance, independently claimed future source/kickoff observations, and an append-only forecast/abstention/revision ledger. It does **not** touch `public.ff_forecasts` or publish predictions. All tables have RLS **ENABLED + FORCE**, no `anon`/`authenticated`/`service_role` read or mutation grants and immutable UPDATE/DELETE/TRUNCATE triggers; all signing receipt inputs remain private. Every model and prediction is marked `UNAPPROVED`, with `publication_allowed=false` and `holdout_2025_26_read=false` immutable database checks.

For captures and forecasts, a **database server clock overrides caller-provided** `captured_at` / `committed_at`. The insert trigger refuses captures older than M4's 2026-11-11 start, anything not in real 2026/27 fixture bounds, source observations later than database capture, stale source observations older than two hours, and anything inside the minimum 15-minute pre-kickoff lead. Forecast inserts lock the selected capture, validate fixture identity and predecessor revision and rely on unique `(fixture_key,model_id,revision)` and idempotency SHA to resolve concurrent first writers. A later revision is a **new immutable row**, never an UPDATE. Synthetic PostgreSQL 17 tests cover RLS/grants, actual database clock, probability/abstention checks, revision lineage, duplicate writer rejection and temporal denial. Because an owner database role could still submit a falsely signed source/kickoff claim, a cryptographic trusted-source verification plus actual prospective observation is **still required for A5**; this DDL alone is not evidence of genuine pre-kickoff input.

This migration is source code under protected CI review; **do not claim live Supabase application or A4 acceptance until separately verified**. It introduces no owner browser write path, scheduled jobs, public model or published forecasts.

## A5 read-only prospective-source observation (in progress)

The first actual future RPL window after M4 startup is **round 15, 20–22 November 2026**. The fixed 8 scheduled kickoff minutes (UTC) and three day counts were cross-checked against the publicly displayed MatchTV and Championat 2026/27 calendars on 2026-11-11. They serve only as a **precommitted calendar consistency test**, not as proof of a provider's original publication time or independent club-ID crosswalk.

`ml/src/football_forecast/research/m4_future_rpl_source.py` validates three bounded real authenticated OpenFoot Starter fixture-response envelopes, requesting only `competition=comp_premier_league_rus&date=YYYY-MM-DD` for 20, 21 and 22 November 2026. It rejects completed, awarded, rescheduled, out-of-scope, missing, invalid-time, duplicate or incomplete fixture data, and checks the predeclared 8 kickoffs and 16 distinct club IDs. It produces only an aggregate SHA-256 of the received raw source envelopes and a conservative **observation-completed UTC**, with `independent_source_confirmed=false`, `genuine_as_of_attested=false`, `model_approved=false`, `forecast_written=false`, `public_forecasts_written=false`, and `holdout_2025_26_read=false`. No private club IDs, source rows or credentials leave the job.

An exact-owner, protected-main, environment-gated one-off read-only job `.github/workflows/m4-future-rpl-source-observation.yml` is invoked only by `/m4-future-rpl-source-readonly` on #304 or its exact workflow-dispatch confirmation. It performs **three** bounded authenticated OpenFoot date GETs plus **one** bounded HTTPS observation of the independently published live MatchTV RPL calendar. The owner read-only jobs on 14 November established that Championat returned an unusable HTML response to GitHub Actions (no visible fixture markers), so that response is explicitly **rejected**, never treated as independent evidence. The separate MatchTV parser requires the round-15 section, all eight directed home/away fixtures, Moscow-to-UTC minutes and unplayed display format in newly fetched visible HTML, refusing absent, revised, blocked or contradictory responses. A successful live MatchTV owner run is still required before using this as prospective corroboration. A pinned schedule alone never qualifies as a live observation. The only returned extra data are the independent publisher response SHA-256 and local runner observation timestamp, **not** signed-time or immutable proof. There are **no database credentials, migration, write grants, public forecast, scheduled execution, or 2025/26 requests**. A successful run means a future fixture source was actually consulted at the visible GitHub run time; a refusal means the source was absent/changed/incomplete, not that a source was silently filled in.

**A5 stays OPEN after this first read-only probe** until a separately corroborated source/kickoff/club mapping is captured with verifiable server clocks into the immutable `ff_m4_future_captures` table and an `ff_m4_shadow_entries` FORECAST/ABSTAIN is committed **before kickoff**. The OpenFoot feed alone cannot substitute for independent kickoff corroboration or first-serving proof. Do not backdate anything.

### A5 GitHub-issued signed-time observation (still no database write)

The protected-main owner-only workflow now requests two **distinct-purpose
GitHub Actions OIDC JWTs** after live authenticated OpenFoot and separately
corroborated MatchTV observations. The first token's custom signed audience
commits to the aggregate OpenFoot envelope SHA-256; the second commits to
the independently fetched MatchTV response SHA-256. The runner verifies
RS256 signatures using public keys from GitHub's **fixed** HTTPS OIDC discovery
and JWKS endpoints, checking repository ID/name, owner ID, protected main
ref and commit, workflow path, environment, run ID/attempt, event kind,
issuance/expiration and digest-specific audiences. No untrusted JWT header
can select a verification endpoint. Tamper/claims/time tests are mandatory.
Private JWTs/JWKs stay in protected worker memory; only SHA-256 and the
GitHub-issued second-precision times enter the bounded read-only receipt.

**Limitations:** both JWTs have **the same signing authority, GitHub**;
only the **underlying football sources** are independent. The publishers'
original first-serving times are NOT independently signed. The GitHub tokens
authenticate that the reviewed worker committed to those digests at GitHub's
issuance time, not an original publisher timestamp. There is still **no
write authorization, PostgreSQL server-clock capture, prospective model
FORECAST/ABSTAIN, or public release**. A5 requires a separate immutable
pre-kickoff DB admission with verified signed-time receipts. The 2025/26
consumed holdout stays sealed.

## Initial code boundary

`apps/web/lib/m4-prospective-preflight.mjs` accepts only a tight metadata envelope and an **untrusted caller-supplied evaluation timestamp**. It performs deterministic structural checks, returning `blocked` or `candidate_only`. Even a positive candidate explicitly reports **`genuineAsOfAttested:false`, `modelApproved:false`, `writeAuthorized:false`, `publicationAuthorized:false`**. Digests are format-tested, not authenticated. **No code may treat this function alone as an authorization to run a model, write to the database, claim an authentic pre-match forecast or release predictions.** A3–A5 must establish actual server-trusted attestation, append-only persistence and private execution. This first gate does not use real source data.

Follow [the M4 milestone issue](https://github.com/StanleyLl0yd/FootballForecast/issues/304). Protected PR, exact-head checks, signed squash, exact-main checks and staged Vercel release verification are mandatory; original M2 escrow/RLS and M3 files remain untouched except accurate acceptance-status text.

## A5 directed club-pair crosswalk (2026-11-12 technical hardening)

Eight *directed* round-15 fixture pairs and exact kickoff UTC slots are predeclared from [Championat](https://www.championat.com/football/_russiapl/tournament/7096/calendar/) and [Sport-Express](https://www.sport-express.ru/football/rfpl/stories/rpl-15-y-tur-raspisanie-rezultaty-novosti-obzory-matchi-20-22-noyabrya-chempionat-rossii-2026-27-2459710/). The pure crosswalk requires each future OpenFoot `homeTeam.name` and `awayTeam.name` to match an explicit conservative canonical alias, both *in the correct direction*, and exactly one private provider ID per canonical club. Unknown aliases, swapped teams, duplicate provider IDs, cross-club collisions and an unexpected pair refuse the entire owner-only source probe. No names or IDs are logged. This is **independent published calendar corroboration of names and UTC kickoff only**, not yet independent live provider attestation, signed capture or DB-clock prospective forecast; A5 stays OPEN.

## A5 prospective signed private transaction (implementation gate)

The separate `m4-owner-prospective-capture.yml` workflow is **not automatic**:
only the exact owner on protected `main` may dispatch a dry-run or an
explicit, independent one-time commit command on issue #304. The old
source-only workflow retains its stronger no-PostgreSQL-secret boundary.

For each run, it newly retrieves three authenticated OpenFoot future-date
envelopes, independently validates all eight directed scheduled fixtures and
16 canonical clubs, fetches the live MatchTV round-15 calendar and checks the
same exact Moscow kickoff minutes, then obtains **two new GitHub RS256 OIDC
tokens** signed to the two distinct response hashes and the capture-workflow
identity. The GitHub issuer is the **same signer** for both JWTs; we do not
pretend this is two-issuer source attestation or original publisher time.

The owner workflow reads only the **one frozen development model** from
`ff_private.ff_m4_candidate_models`, strictly validates artifact bytes and
SHA, uses only the provider's **exact previously trained club ID** as a match
(no name heuristics), and chooses an untouched private `FORECAST` or
`ABSTAIN/UNKNOWN_MODEL_CLUB_ID`. Any uncertain identity is never inferred.
The entire eight-match first-revision batch, private model reference,
timestamps, original provider match and club identifiers, two JWTs, two
public GitHub signing JWKs and cryptographic SHA linkage are committed in a
**single PostgreSQL SERIALIZABLE transaction**. PostgreSQL, not the runner,
assigns capture, proof and entry timestamps and rejects captures within
15 minutes of kickoff. All append-only `ff_private` objects have FORCE
RLS and revoke all client access. No public forecast endpoints are touched.

`/m4-private-capture-dry-run` is a read-only preparation gate.
`/m4-private-capture-once` is the separately gated private write.
Both command strings require the same pinned owner user ID, owner association,
issue number and main SHA; the write job also verifies PostgreSQL's pinned TLS
CA. Do not dispatch commit until exact-HEAD CI and disposable PG17 tests pass,
the private migration has been applied and the owner dry-run succeeds.

**Honest limitations:** the database verifies token hashes, source-club
mapping digests and server-clock freshness, while the protected worker
checks actual RS256 signatures. It does not independently replay GitHub's
JWKS later without archived provenance, nor prove that either football
provider originally served the data at the GitHub token issuance time.
Post-match proper scores, paired baseline and prospective performance
remain A6, never claims in A5.

## A6 pre-outcome null baseline lock (2026-11-16, before round-15 kickoffs)

For the first genuinely prospective cohort, the *only* admissible paired
comparator is the predeclared, outcome-independent three-way uniform 1X2
distribution: `P(home)=P(draw)=P(away)=1/3` for every FORECAST. It is an
intentionally simple **null baseline**, not a competitively tuned model and
not a claim of predictive superiority. A missing baseline remains explicitly
missing; the private reducer rejects any other supplied prior rather than
allowing a post-result chosen comparator. ABSTAIN fixtures cannot be scored.

A nominal `finished` flag is not enough: a synthetic result's reviewed
timestamp must be at least 90 minutes after scheduled kickoff. This is a
**minimum** temporal refusal, not evidence that the match actually finished.
An A6 owner-only settlement must still independently corroborate a genuinely
played final score from two separately observed sources, reject technical
awards/abandonments/revisions/ambiguous identifiers, and verify linkage to
the already immutable A5 capture/proof/forecast records. No 2025/26 access
or public prediction/score release is authorized. Until verified post-match
outcomes exist, A6 and all prospective performance estimates remain OPEN.


## A6 outcome-blind dual-source result admission (prepared 2026-11-17)

The first eight immutable A5 fixtures kick off 20–22 November 2026.
**No results are available as of this preparation; A6 remains OPEN.**
The frozen first-cohort maximum is six scorable pre-match FORECASTs and
two ABSTAINs. A prospective score/skill, calibration or model-approval
claim cannot be inferred from the existing 8/8/8 A5 receipts.

Before the outcomes exist, the pure
`ml/src/football_forecast/evaluation/m4_result_admission.py`
pre-registers an **OpenFoot primary / MatchTV corroboration** candidate
comparison. Only the exact same frozen RPL 2026/27 fixture identity, directed
teams, UTC kickoff, and the OpenFoot match ID stored in the original A5
signed-time proof may be considered. The corroborating MatchTV reference
must differ from the frozen OpenFoot provider match ID, consistently with
the private PostgreSQL observation guard. Both source references must satisfy
strict, path-free identifier bounds; they are never interpreted as URLs.
Independently declared provider records, two distinct
SHA-256 response digests, explicit **finished AND played** classifications,
matching non-technical score and claimed observations at least 90 minutes
after scheduled kickoff pass its *structural* checks. Missing status,
revisions, abandonments, disciplinary/awarded results, different or reversed
clubs, incompatible scores, early result claims or unreliable source
availability **refuse** the candidate. Claims are synthetic in CI.
The only output classification is
`PRIVATE_RESULT_CANDIDATE_UNATTESTED`, with independent source-time
attestation, played-final attestation, settlement and publication permissions
**all false**. Distinct issuers or digests alone do not prove independent
football reporting or actual first-observation time.

A6 actual settlement requires a **separate reviewed owner-only execution**
after each match is genuinely over. It must freshly retrieve only the eight
A5 fixture identifiers (never a league-wide historical or 2025/26 listing),
validate the publishers' actual result semantics and independence, establish
real read/commit server UTC and signed-time receipts, bind both source claims
to original immutable A5 capture/proof/forecast IDs and their frozen code,
model and input digests, and persist an append-only private result ledger with
RLS before calling the pure provisional scorer. MatchTV's ability to provide
independent **played-vs-technical** evidence has **not yet been established**.
If its score/status evidence is absent or ambiguous, **ABSTAIN on settlement**
and require a newly reviewed source/protocol change *before* using a fallback.
The provisional comparator never substitutes for those checks.

For verified played outcomes only, score the pre-match immutable latest valid
revision, preserving the original first-observation and forecast clocks.
Record sample size, abstention reason counts, forecast coverage among all
tracked fixtures, pending/technical/unverified outcomes separately, H/D/A
Log Loss, unnormalized three-class Brier and two-threshold RPS. The
uniform 1/3–1/3–1/3 paired baseline was frozen in PR #323 before kickoff;
no later comparator selection, label-based tuning or reweighting is allowed.
Uncertainty and calibration must disclose the *very small*, correlated
matchday sample. With at most six first-cohort forecasts, no credible model
superiority, calibrated-model or production-readiness claim is supportable.
Later official result revisions must generate additional immutable provenance,
never overwrite the original result evidence or private A5 predictions.
No outcome is public and no public forecast is authorized.

## A6 private result candidate escrow (pre-outcome preparation; NOT deployed)

`database/migrations/0017_m4_private_postmatch_candidates.sql` defines two
separate strictly private, immutable tables for **claimed** played results:
source-specific `ff_m4_result_observations` and
`ff_m4_result_candidate_settlements`. Neither table may be mistaken for an
authenticated result, an accepted A6 score, a production evaluation, or a
public result feed. Every row is marked unattested, owner-unapproved and
publication-denied. Both tables have FORCE RLS, no client grants and
UPDATE/DELETE/TRUNCATE denial triggers.

Before an observation can be inserted, PostgreSQL must find the existing A5
capture and GitHub time proof, verify fixture/directed club identity, and
require the OpenFoot result match ID to equal the *original* A5 provider
match ID. The result claim must be explicitly `finished` **and** `played`;
any `awarded`, technical, revised or uncertain result is refused rather
than assigned played goals. GitHub-issued source time must be no earlier
than 90 minutes after scheduled kickoff and within the last 20 minutes of
the PostgreSQL-assigned insertion time. An independent, currently reviewed
owner-only runner is still needed to verify JWT RS256, exact audience,
publisher response digests, issuer/fixture semantics and live fetch time;
the database verifies only SHA integrity and relational/time constraints.
A spoofed issuer name or fabricated JWT **is not independent proof**.

The candidate-settlement trigger requires two separately claimed sources
(OpenFoot first, MatchTV second), two different raw-response SHA hashes,
two different JWT-token hashes, the same protected run/attempt/code SHA,
identical played score, exact original A5 forecast identity, and real
postgame PostgreSQL commit time. A mismatch fails the **whole** candidate.
An A5 `ABSTAIN` fixture may retain private source observations, but cannot
create a candidate settlement against an `ABSTAIN` shadow entry. A prior
`FORECAST` superseded by a later abstention also cannot be newly settled.
No observation or settlement candidate creates a retroactive forecast.
Later corrected outcomes require newly observed provider evidence and a new
sequential immutable revision; no original A5 forecast or earlier result
candidate may be modified.

`database/tests/0028_m4_private_postmatch_candidates.sql` is **disposable
PG17-only**, includes synthetic historical A5 setup using disabled A5
insert-clock triggers *inside a transaction that rolls back*, and restores
all triggers before actual A6 insert tests. This test must NEVER run on
Supabase production. It verifies only database integrity semantics, not
source authenticity. No live migration, result feed, owner write workflow,
score release, public page or A6 acceptance is authorized by these files.
A6 remains OPEN until actual post-match evidence is independently accepted.


## A6 post-match GitHub signed byte-clock preflight (candidate only)

The A6 candidate-only schema in migration 0017 and its rollback-only PG17 tests do not verify OIDC signatures, publisher ownership, the parsed response body, or played/technical semantics. They MUST NOT be interpreted as a result settlement or permission to compute performance. Migration 0017 remains **undeployed** to live Supabase until separately authorized and reviewed.

The pure verifier in `ml/src/football_forecast/evaluation/m4_result_oidc.py` pins the separate future `m4-owner-postmatch-observe.yml` GitHub workflow identity and accepts only two independently collected, in-scope *candidate* response bodies whose raw SHA-256 matches the individually declared source claims. It verifies two distinct RS256 GitHub OIDC JWTs against the exact OpenFoot/MatchTV raw-body digest audiences, expected owner, repository ID, protected `main` SHA, run attempt, environment, workflow and short issuance windows. JWKs must come from GitHub's fixed HTTPS OIDC discovery and JWKS endpoint; headers, provider bodies, UI or user input must never select keys. Only GitHub-issued proof of digest commitment time is attested, not original publisher publication time.

The module performs **no network, live parsing, PostgreSQL writes, scoring, model approval or publication**. Its returned evidence explicitly leaves publisher authenticity, independent played-final status and all settlement, scoring, publication and holdout permissions **false**. Tests use synthetic locally signed JWTs, scores and source bytes only. A subsequently reviewed owner-only workflow MUST authenticate each publisher response separately, parse both result semantics against the immutable A5 source match ID, verify two independent played-final observations, obtain new actual GitHub tokens from the trusted runner, and durably store the complete private evidence before anyone can consider A6 acceptance. Missing, ambiguous, awarded, abandoned, revised or stale results must fail closed. Nothing may be backfilled from the consumed 2025/26 holdout.


## A6 distinct result-source parsing preflight (unattested)

`ml/src/football_forecast/evaluation/m4_postmatch_sources.py` parses exactly
the A5-anchored 2026/27 round-15 OpenFoot match response and a newly fetched
**current-season MatchTV calendar** scoped to round 15, not an individual
match detail page. MatchTV detail pages embed historical head-to-head tables
including the consumed 2025/26 holdout: neither the protected worker nor tests
may use those pages as a live source. A pinned MatchTV match ID is an opaque
source reference, not independent proof of the served content or final status.

OpenFoot input is one newly retrieved authenticated fixture envelope with the
original A5 provider match ID, kickoff, team names and exact provider IDs.
Only explicit `finished` + `resultKind=played` with bounded integers
`score.home/away` is a structural candidate. Missing played/technical
semantics MUST fail closed. The MatchTV calendar must expose exactly the
precommitted round-15 eight directed fixtures in current-season day sections,
now formatted `HOME GOALS AWAY GOALS`, never a scheduled `HOME AWAY HH:MM`.
Missing, duplicate, changed, ambiguous or technical/awarded indications refuse
the entire batch. The displayed MatchTV score is only an untrusted claim; it
does not prove a genuine played result, original publication time or publisher
authentication.

Both parsers produce **untrusted** `ProviderResultClaim` objects only.
Crucially, the MatchTV calendar parser returns
`status=score_displayed_unverified` and `result_kind=unknown`, **never**
`played` inferred from a score link. Even when both observed scores agree,
`compare_provisional_played_claims` MUST reject this pair. An independently
reviewed, authentic played-final source is mandatory before any A6 candidate
can be admitted. GitHub OIDC signed-byte clocks do not alter this requirement. No automatic result writes, performance scoring,
model approval, historical backfill or publication are authorized. The
synthetic-only tests include wrong match IDs/club direction/kickoff, award,
disagreement, duplicate/untrusted forms, scheduled-versus-scored ambiguity and invalid UTC.
Real worker acquisition, protected owner execution and real A5 ledger linkage
remain separate required gates; the A6 live SQL tables remain undeployed.

**Source-capability blocker (2026-11-23):** The public [OpenFoot API documentation](https://openfootapi.com/docs) describes `finished` and `score` but does not document an independent `resultKind=played` proof distinguishing on-field outcomes from administrative/technical awards. The parser deliberately **requires** explicit `played` and fails closed when missing. A successful public scoreboard is not authorization to manufacture that field or to score M4 forecasts. Before any protected live result evaluation, review actual newly fetched 2026/27 schema privately and obtain independent official played-versus-technical evidence; do not weaken the rule.

## A6 owner-only post-match READONLY experimental workflow (not settlement)

The separate `.github/workflows/m4-owner-postmatch-observe.yml` can only be
activated by the exact repository owner on protected `main` via an explicit
`M4_RESULT_READONLY` dispatch or the exact issue-304 comment
`/m4-result-readonly`. It is not automatic. The workflow has no write
authorization in its own output contract: the bound receipt must show zero
database writes, zero score/settlement/model/publication authorizations and
zero 2025/26 access. It uses the existing pinned Supabase root CA, a read-only
PostgreSQL 17 transaction with `default_transaction_read_only=on`,
private A5 capture/source-ID/club-ID provenance, and the frozen unapproved
model identity. Exactly eight A5 records are expected, with six FORECAST and
two ABSTAIN; neither ABSTAIN can be scored.

The runner newly fetches only the eight precisely scoped 2026/27 OpenFoot
single-fixture API responses and the fixed MatchTV 2026/27 round-15 calendar.
Individual match-detail pages must NEVER be fetched because they contain
historic head-to-head rows including the consumed 2025/26 holdout. Redirects, duplicate or ambiguous
club IDs, wrong match/season/round, early/awarded/postponed outcomes, non-JSON,
incorrect HTML/status/time, inconsistent score, stale GitHub OIDC time or
unavailable independent sources cause a complete **refusal**. Missing OpenFoot
`resultKind=played` is recorded internally as **UNKNOWN** for digest-only
observation; it MUST NOT be promoted to final played evidence or settlement.
The current-season MatchTV score always remains **UNKNOWN** played status.
Each private pair is separately cryptographically bound to two fresh GitHub
RS256 JWT audiences for the exact raw source bytes and the protected owner
workflow identity.

A successful run proves only a **current GitHub-signed response-digest
comparison and immutable A5 linkage**. The returned object is an unattested
byte-clock, not a result-candidate settlement; both sources may have missing
played semantics. GitHub signs the evidence time, NOT
the publisher's original timestamp or football result. It is not an
independent played-final certification. Only an aggregate count, code/run
identifiers and opaque batch digest can appear in the job summary; no
individual scores, private forecasts, source bodies, JWTs, API credentials
or crosswalk IDs may be printed or uploaded. No SQL migration 0017, no A6
observation rows, no calibration/LogLoss/Brier/RPS and no production score
approval are performed. After any genuine owner run, examine the complete
attested aggregate result and separately review final played-vs-technical
semantics before authorizing future private A6 settlement.

**Source-capability blocker (2026-11-23):** The public [OpenFoot API documentation](https://openfootapi.com/docs) describes `finished` and `score` but does not document an independent `resultKind=played` proof distinguishing on-field outcomes from administrative/technical awards. The parser deliberately **requires** explicit `played` and fails closed when missing. A successful public scoreboard is not authorization to manufacture that field or to score M4 forecasts. Before any protected live result evaluation, review actual newly fetched 2026/27 schema privately and obtain independent official played-versus-technical evidence; do not weaken the rule.


## A6 OpenFoot played-field capability probe (aggregate-only)

The exact-owner read-only A6 workflow optionally reports bounded `0..8`
counts for explicit OpenFoot `resultKind=played` metadata versus absent or
otherwise unverified played metadata. This is **not** permission to infer
genuine played status from `status=finished`, score agreement, minute-by-minute
reports or media headlines. The eight MatchTV calendar results always have
`result_kind=unknown` and cannot independently attest on-field finality.

The protected Python runner only classifies *already accepted source shapes*,
and the workflow verifies strict integer types, count conservation to exactly
eight, and mandatory `sourceStatusSchemaOnly=true`, while all DB-write,
scoring, settlement, approval, holdout and publication flags remain false.
It outputs only aggregate counts without fixture IDs, individual scores,
private forecast probabilities, source bodies or JWTs. This diagnostic may
establish whether an explicit source field actually exists in the freshly
fetched 2026/27 API data, **not** whether the publisher's statement is
independently true, official or immune to later disciplinary revisions.
Even eight explicit OpenFoot fields would not lift the MatchTV `unknown`
or the A6 independent played-versus-technical proof requirement.

Do not use this exploratory read-only source schema evidence to write the
unapplied A6 tables, calculate private prospective scores, access the sealed
2025/26 holdout, approve a model, or publish forecasts.


## A6 independent club-operated 2026/27 on-field report candidates

On 2026-11-23 a third class of source was located for **all eight** original
2026/27 round-15 A5 fixtures, separate from OpenFoot's finished-score data and
the MatchTV current-season calendar. Pinned **club-operated** post-match
match reports or match-centre articles are enumerated in
`ml/src/football_forecast/evaluation/m4_club_report_review.py`. They are
**candidate locators only**, not yet authenticated or ingested by the protected
owner worker. Each points to a current-season specific report, NEVER to
2025/26 head-to-head history or generic club season archives.

| A5 fixture | Reporting club | Current-season source |
| --- | --- | --- |
| Rostov – Krylya | Rostov | https://fc-rostov.ru/media/news/pobezhdaem-krylya-sovetov |
| Orenburg – Baltika | Baltika | https://fc-baltika.ru/news/pobeda_v_orenburge/ |
| Akron – Fakel | Akron | https://fcakron.ru/news/2534 |
| Rubin – Zenit | Rubin | https://www.rubin-kazan.ru/news/rubin-zenit-3-1/ |
| CSKA – Akhmat | CSKA | https://pfc-cska.com/ru/novosti/vse-novosti/32787-pfk-cska-ahmat-12/ |
| Dynamo Moscow – Krasnodar | Krasnodar | https://www.fckrasnodar.ru/team/news/object/?object_id=154573 |
| Dynamo Makhachkala – Spartak | Spartak | https://spartak.com/matches/5f5730c0-3698-4a75-a13a-158157ea11c7/broadcast |
| Rodina – Lokomotiv | Lokomotiv | https://www.fclm.ru/news/n/rodina-lokomotiv-rpl-2026-27-match-summary/ |

The official RFS prematch referee appointments published 2026-11-19:
https://www.rfs.ru/news/225626. This is a fixture/officials corroboration
source, **not** on-field completion evidence. RFS KDK archive:
https://www.rfs.ru/archive?tags=16. An empty search or no article yet
**cannot** certify that no technical award, match annulment or delayed
administrative revision will happen.

The pure review module checks exactly pinned third-party report URL, reporting
club, original A5 directed fixture ID/kickoff, current season and round, bounded
claimed result, strictly ordered on-field event *claims*, and consistency with
the two existing UNKNOWN-played score observations. It rejects technical,
annulled, abandoned, replay or revised KDK dispositions even when all three
scores agree. Missing KDK evidence or an archive search returning nothing
always yields **KDK_UNRESOLVED**. All claims are caller-controlled and have no
publisher-authenticated first-serving timestamp. Its output has explicit
`played_final_attested=false`, `kdk_clearance_attested=false`, and permanently
false DB settlement, scoring, model-approval, publication and holdout flags.

Next: verify actual live report-body shapes for current-season-only pages
without reading any sealed 2025/26 content; add protected owner-only HTTPS
fetch with exact source pins, bounded bytes, no redirects or historical H2H,
raw-body hashes and GitHub OIDC time receipts, plus independent official
league match-protocol/disciplinary decision status. A future official
match-protocol *claim* is still not final until independently authenticated.
NEVER infer affirmative clearance from KDK silence. No migration 0017 or A6
write/scoring is authorized by this technical preparation.


## A6 owner-only club source-body byte-clock observation (separate from scoring)

The prospective third-source club articles listed above can be probed by
the separate protected manual workflow

`.github/workflows/m4-owner-club-report-digests.yml`. No execution occurs
on PRs, releases, schedules, site visits or ordinary issue comments.
Only the exact owner's explicit GitHub Actions dispatch with
`M4_CLUB_READONLY`, or the exact owner-only issue #333 comment
`/m4-club-digests-readonly`, can start it from protected `main`.

The ephemeral runner has only `contents: read`, `id-token: write` and
the protected `m1-source-import` environment. It receives **no Supabase
credentials**, no OpenFoot token, no private A5 fixture rows, and no A6 write
authority. It fetches the eight fixed HTTPS **2026/27 round-15 club-owned
article URLs only**, with TLS validation, redirect denial and an 8 MB
upper bound. It binds the exact received source bytes to distinct GitHub
RS256 OIDC JWT audiences under the new fixed workflow identity, rejecting
wrong repository/actor/ref/run, JWKS/signature, stale/early clocks or
mismatched digest. On success the ephemeral response bytes/JWTs stay out
of logs: only **one bounded aggregate eight-source receipt**, plus an opaque
batch digest, is printed. On failure the job shows only a constant safe
stage/ordinal and refuses the entire batch.

**Epistemic limit:** GitHub signs that a protected runner requested token(s)
for its own claimed raw SHA-256 digest at a given time, NOT the external club's
original server-time or the authenticity/completeness of the article's match
events. This workflow doesn't parse goal scorers or prove on-field activity,
and deliberately does **not** query RFS KDK/disciplinary evidence; a
successful eight-source fetch is **not** official played-final certification.
All output authorization flags remain false, including
`onFieldPlayedAttested`, `kdkClearanceAttested`, `databaseWrite`,
`settlementAuthorized`, `scoringAuthorized`, `modelApproved`,
`publicationAuthorized` and `holdout2025_26Read`.

An independent, current-season official RPL/RFS match-protocol
verification plus defensible KDK decision/revision monitoring remains
required to close #333. Migration 0017, actual settlement, post-match
metrics and public forecasting remain forbidden.


## A6 live third-source connectivity — 2026-11-23

The first protected real owner-only read-only run
[#45173060342](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/45173060342)
**FAILED CLOSED** at sorted current-season club #7 (the pinned Spartak
Dynamo-Makhachkala 22 Nov 2026 match broadcast URL). Six earlier source
response byte-clock proofs succeeded during this volatile attempt, but the
batch was rejected **before any aggregate receipt**; the eighth page was
not checked. No private database credentials, A6 rows, settlement, scoring,
public forecasts, or held-out 2025/26 fixtures were used. The existing
failure code exposed only the source ordinal, not whether the site returned
HTTP 403, an unexpected redirect, wrong MIME or another transport error.

The follow-up adds only an *allowlisted safe transport failure reason* on
the same exact pinned, no-redirect HTTPS paths: HTTP status class, redirect,
wrong HTML MIME, bounded body size or generic transport. **No response
headers, body, URL, redirect target, exceptions or JWTs are ever logged**.
The full eight-source batch still fails closed for any individual failure,
and even a successful fetch authenticates no on-field played result or
disciplinary clearance. Future work must correct the actual source
availability issue without broadening URL discovery or reading historic H2H.
