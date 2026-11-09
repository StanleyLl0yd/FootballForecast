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

## Required work before A3 can be checked off

1. Independently pin and evaluate *full* 2018/19–2024/25 source/reference bytes and actual reuse scope without touching the consumed 2025/26 holdout. No bulk import from a public reference merely because its season table is online.
2. Prepare a restricted, reviewed **per-fixture** identity policy matching season, date, home/away club, on-field score, played-versus-awarded status, and independent historical result-revision chronology. For promoted/renamed clubs, require actual club-continuity proof rather than matching provider display names.
3. Establish original event kickoff UTC and information-availability evidence per field where possible. If only calendar date is confirmed, mark `NON_STRICT_RETROSPECTIVE` and **never invent midnight kickoff**.
4. Run a distinct least-privileged **owner-only development-archive inspection** only after the exact contract, source eligibility, confidentiality and fail-closed controls are reviewed. Publish aggregate SHA/count/coverage/denial receipts only. Do not rewrite the existing immutable private source or M2 model.
5. Count and report the **actual matched and eligible private rows**, separately by season, status, rejection cause and cutoff trust. Include no-data and abstention denominators. Until that evidence exists **A3 remains OPEN**, A4 real multi-season fitting and A5 real evaluation remain blocked.

No public forecasts, real M3 model fit, per-match source data, quote import, owner credential changes, private DB migration or 2025/26 evaluation are authorized by this read-only triage. This is not M3 acceptance.
