# M3 source-readiness assessment · 2026-11-09 · INCOMPLETE

Tracking: [M3 #271](https://github.com/StanleyLl0yd/FootballForecast/issues/271), specifically **A3**. This is a **public aggregate-evidence inventory**, not a new source download, independent per-fixture comparison, private match read, training approval, or a 2025/26 holdout operation.

## What is actually known

The prior [seven-season private archive receipt](M2_PRIVATE_RPL_HISTORY_EVIDENCE.json) attests **7 immutable private snapshots / 1,680 provider-finished result rows**, 240 per season. It does **not** independently prove original results, whether each outcome was played, true UTC kickoff/first availability, or cross-source club identity. The source-only data remains private; **zero newly independently attested private training rows**, meaning *unverified*, not proof that zero played matches exist.

Existing separate public CC0 references [source shape](M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json) cover **five** development seasons and **1,200 structural rows**. The two checked CC0 paths for **2021/22 and 2022/23 are absent**. This does not mean the seasons are undocumented anywhere. Independent public retrospective RSSSF archives exist for [2021/22](https://www.rsssf.org/tablesr/rus2022.html) (240 league games) and [2022/23](https://www.rsssf.org/tablesr/rus2023.html) (240 league games, including a later technical award reflected in its final table). They are **reference candidates only**: no source match IDs, historical publication times, original raw bytes or license for automated extraction have been independently attested, and no private-archive crosswalk has been executed.

| Development season | Private source rows | CC0 rows at checked pinned path | Explicit public CC0 technical awards confirmed | Public rows without inline clock | Known separate review |
| --- | ---: | ---: | ---: | ---: | --- |
| 2018/19 | 240 | 240 | 0 | 0 | Other played-score provenance unverified |
| 2019/20 | 240 | 240 | 4 | 2 | Four technical results confirmed not played |
| 2020/21 | 240 | 240 | 2 | 2 | Two technical results confirmed not played |
| 2021/22 | 240 | Not found in checked CC0 paths | Not assessed | Not assessed | RSSSF public retrospective reference exists |
| 2022/23 | 240 | Not found in checked CC0 paths | Not assessed | Not assessed | Played match subsequently assigned a different official result |
| 2023/24 | 240 | 240 | Not classified in text | 19 | One false home/away direction, one duplicated and one missing directed pairing |
| 2024/25 | 240 | 240 | Not classified in text | 24 | No whole-season played-goal proof |
| **Total** | **1,680** | **1,200 at five CC0 paths** | **6 confirmed among explicit CC0 awards** | **47 in those public reference files** | **No per-fixture eligibility crosswalk** |

The six known technical results are documented in [public anomaly corroboration](M2_CC0_RPL_ANOMALY_CORROBORATION_EVIDENCE.json). Do **not** simply subtract six from the 1,680 *private provider rows*: the six belong to a different public archive and private row-level mapping has not been verified. Nor should the 47 inline-clock omissions be called 47 missing kickoffs in the private archive. In particular, this is not evidence of 1,674 eligible private played fixtures.

A separate [official-result revision study](M2_PUBLIC_RPL_RESULT_REVISION_EVIDENCE.json) found one **actually played 2022/23 fixture** whose initial on-field result was later replaced by an administrative decision. This is different from an **unplayed** technical award: it requires historical result-role selection and an independently verified version timeline, **not** generic exclusion of the match or use of the later awarded goals as played goals.

[Same-provider identity sample](M2_RPL_TEAM_IDENTITY_SAMPLE_EVIDENCE.json) reports **26 provider IDs**, adjacent-season shared IDs **14/14/14/13/14/13**, 82 repeated-ID name agreements. It is not independent legal-club, promotion/renaming or cross-provider identity evidence. The first-page schema presence audit found no verified coach/lineup/xG/odds feature data. [Public source-rights review](M2_HISTORICAL_SOURCE_RIGHTS_GATE_EVIDENCE.json) does not certify upstream data reuse; assess independently before automating bulk use.

## Machine-checked refusal, not source certification

`football_forecast.research.m3_source_readiness.summarize_source_readiness` combines six **existing aggregate public evidence files only**, validates their exact seven-year provenance boundaries and mutually consistent counts, refuses contradicting/mutated/2025–26 assertions, and emits **only per-season aggregate readiness**. It performs no filesystem, network or database access internally; tests load the tracked evidence.

Every season has **`status=BLOCKED_PER_FIXTURE_INDEPENDENT_EVIDENCE_MISSING`**, **0 independently proven eligible private rows**, and **`real_training_authorized=false`**. This is an *epistemic count*, not the true number of playable fixtures. No subset of this summary is eligible for an M3 fit. The numeric fields represent separate public CC0 source observations, not private source exclusions.

## Two missing-CC0-season reference and rights verification (2026-11-10, public pages only)

This is a **bounded public-document review**, not a third-party dataset ingestion, privately identified fixture comparison, approval of automated collection, or new Supabase inspection. The established six official RFS 2021/22–2022/23 schedule/score anchors in [their earlier receipt](M3_TWO_SEASON_SIX_RFS_ANCHORS_REPRODUCTION_2026-11-10.md) are **not rerun** here.

- **2021/22:** [RSSSF 2021/22 Premier League](https://www.rsssf.org/tablesr/rus2022.html) publishes a 16-club final table (30 games per club) and round-by-round results. This is a retrospective *reference candidate*, not a publisher-declared CC0 replacement, evidence of contemporaneous kickoff times, or independent proof of the seven-season private ID mapping.
- **2022/23:** [RSSSF 2022/23 Premier League](https://www.rsssf.org/tablesr/rus2023.html) likewise reports a 16-club, 30-game table and explicitly records **Pari NN–Torpedo, 2023-03-19: played 1:1, subsequently awarded 0:3**. Its displayed 0:3 is an **official administrative result, not on-field goals**; an automatic training-label parser that reads just the headline score would contaminate the played-goal cohort. The page says Nizhniy Novgorod was renamed Pari NN and notes Torpedo's temporary Khimki home ground: both require season/date-aware identity and venue checks.
- **RSSSF reuse:** the [RSSSF charter](https://www.rsssf.org/charter.html) declares archive material copyright-protected even though publicly accessible. The [introduction](https://www.rsssf.org/) allows copying *that introduction* with attribution; it is **not** a blanket machine-readable licence for these two season tables. The pages may be manually consulted for bounded fact corroboration; no automatic wholesale RSSSF export or full-season training import is authorized from this review.
- **Alternative research candidates:** [Football-Data.co.uk Russia](https://football-data.co.uk/russia.php) advertises historical CSVs, including both seasons (the site's own free/private-use and access conditions documented in [DATA_SOURCES.md](DATA_SOURCES.md) remain applicable). Its historical odds lack an authenticated quote-availability timestamp for our fixed prior-day cutoff. Footbolno's separately inventoried season-level coverage is likewise a structure-only candidate, not a verified replacement. Neither was downloaded in this review.
- **Existing private provider terms:** [OpenFootAPI terms, effective 2026-09-07](https://openfootapi.com/terms), section 7, permit **internal statistical research, model training and validation on lawfully received data**, with indefinite local retention. However, the same section explicitly defers licence and attribution conditions to each upstream competition source, surfaced as `meta.sources` and `/v1/competitions` licence metadata. This is **partial rights clarification**, not full certification of the actual seven-season private RPL feed, its upstream provenance, redistribution, or its original match reports. The immutable [M2 import schema](../database/migrations/0013_m2_private_rpl_history.sql) retained `source_name`, `terms_url`, source-response and normalized-row hashes, but **not per-page/per-competition source attribution or licence statements**. The historic source pages were discarded by design; hashes cannot reconstruct these missing licence facts.

**Actionable source-rights gate:** first independently pin the relevant *actual historical RPL competition* attribution and licence for each development year, its date-effective terms and permitted internal model-training scope, without changing the original immutable snapshots. If the upstream source or its licence is unknown, return `RIGHTS_UNVERIFIED`; if an explicit restriction applies, return `RIGHTS_BLOCKED`. A general provider TOS permission cannot override a source-specific restriction. Any future limited owner-triggered metadata observation needs its own reviewed bounds, privacy contract and non-secret aggregate/hash-only receipt. No new bulk fetch, public endpoint, migration or training is approved here.

**Proposed restricted correlation output contract, not an executed query:** for each of the seven allowlisted seasons, expose only aggregate totals of inspected provider rows, independently mapped identity candidates, independently corroborated played-goal labels, technical/revised-result rejects, trusted scheduled/actual time observations, original-source availability proofs, source-rights approvals, and still-unverified rows, plus an evidence SHA-256 and explicit fail-closed outcome. Do not output private match/team IDs, named private pairings, scores, kickoffs or source snippets. Validate each season's 240-row denominator; refuse 2025/26, unreviewed independent sources, ambiguous mapping, mixed record roles and accidental post-match “as-of” claims. This **requires separate explicit owner approval** before any new row-level private correlation, even if SQL is SELECT-only. The earlier aggregate-only SQL receipts remain valid as limited observations, not this authorization.

**Effect on acceptance: none.** A3 remains OPEN, M3 2/8; independently certified eligible private rows remain **zero attested, not zero existing**. A4 real fitting and A5 evaluation remain blocked. The consumed 2025/26 holdout, seven private snapshots, M2 escrow, production and RLS are unchanged.

## Owner-visible seven-season rights refusal (2026-11-10, no database access)

[Public-only source-rights evidence](M3_A3_SOURCE_RIGHTS_READINESS_EVIDENCE.json)
records all seven private source seasons as `RIGHTS_UNVERIFIED`, not
`RIGHTS_BLOCKED` or licensed/eligible; the zero attested eligible count is
**an evidentiary gap, not a finding that no historical matches are usable**.
The provider TOS permits internal lawful research, but neither the immutable
private snapshot nor the discarded source response pages retain their actual
per-season upstream source licence. OpenFootball's repository-declared CC0
does not license the *private OpenFoot feed* by implication. RSSSF and
Football-Data.co.uk remain explicitly limited retrospective reference candidates.

The no-I/O [closed-schema inspector](../apps/web/lib/m3-source-rights.mjs)
rejects malformed source classifications, any attempt to assert a verified
upstream licence, a positive training/correlation gate, 2025/26 access,
additional private rows, or altered season counts. The existing authenticated
`/admin/research` view displays either this conservative seven-season
status or a **fail-closed invalid-evidence message**. Tests mutate the
evidence adversarially. This is a guard on *public metadata only* and **cannot
by itself validate legal source rights or sign off A3**. Replacing an unknown
rights status with positive evidence will require an independent review,
revised code/contract and protected PR; changing JSON alone cannot authorize
a private DB read, model training or release.

## Required work before A3 can be checked off

1. Independently pin and evaluate *full* 2018/19–2024/25 source/reference bytes and actual reuse scope without touching the consumed 2025/26 holdout. No bulk import from a public reference merely because its season table is online.
2. Prepare a restricted, reviewed **per-fixture** identity policy matching season, date, home/away club, on-field score, played-versus-awarded status, and independent historical result-revision chronology. For promoted/renamed clubs, require actual club-continuity proof rather than matching provider display names.
3. Establish original event kickoff UTC and information-availability evidence per field where possible. If only calendar date is confirmed, mark `NON_STRICT_RETROSPECTIVE` and **never invent midnight kickoff**.
4. Run a distinct least-privileged **owner-only development-archive inspection** only after the exact contract, source eligibility, confidentiality and fail-closed controls are reviewed. Publish aggregate SHA/count/coverage/denial receipts only. Do not rewrite the existing immutable private source or M2 model.
5. Count and report the **actual matched and eligible private rows**, separately by season, status, rejection cause and cutoff trust. Include no-data and abstention denominators. Until that evidence exists **A3 remains OPEN**, A4 real multi-season fitting and A5 real evaluation remain blocked.

No public forecasts, real M3 model fit, per-match source data, quote import, owner credential changes, private DB migration or 2025/26 evaluation are authorized by this read-only triage. This is not M3 acceptance.
