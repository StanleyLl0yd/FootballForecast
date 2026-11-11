# M3-A3 retrospective source-quality readiness, 11 November 2026

**Decision proposed, not silently granted.** For the tightly defined `NON_STRICT_RETROSPECTIVE` development experiment whose training fold consists only of previously completed league seasons, the historical **date/home-away and official-result correspondence** evidence is complete at **1,680/1,680** public-vs-private fixtures. This is distinct from proving live pre-match serving times or an original kickoff minute. The owner's amended #271 scope permits a retrospective fold without presenting it as original *as-of*.

## Independent technical receipts

The already committed `docs/M3_SCORE_FREE_FIXTURE_GRAPH_EVIDENCE.json` resolves 1,200/1,200 dated directed private/public fixture identities from 2018/19, 2019/20, 2020/21, 2023/24 and 2024/25. Its score checks run **after** solving anonymous club identity; there were zero reported score disagreements. Its 2023/24 source-direction error is corrected in memory with independent club references, with the raw source untouched.

Protected [#298](https://github.com/StanleyLl0yd/FootballForecast/pull/298) audits the exact RSSSF 2021/22 and 2022/23 season pages to 240/240 each, 16 clubs and league goals 359/280 and 411/319. Protected [#299](https://github.com/StanleyLl0yd/FootballForecast/pull/299), **actually executed** in [GitHub Actions #42995967341](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/42995967341), independently maps all 480/480 fixture dates and home/away clubs (32/32), all retrospective official scores (zero disagreements), 13/13 shared club IDs, and explicitly segregates the one revised 2022/23 0:3 score (played 1:1). No private records/club IDs were exported. Digest: `e3032565aa0332b03b39b1860f33179dbd003dd19224474a2418bd497e1d331d`.

Seven earlier corroborated administrative exceptions (six never-played technical awards and the single official post-play revision) are **excluded** from played-goals candidate labels. Result: 1,673 retrospective played-goal **candidates** out of 1,680 provider-finished records. This is a development-label classification based on public retrospective correspondence and known exceptions, *not* assertion that unknown future corrections cannot exist. Do not fill any later discovered mismatch silently.

Protected [#297](https://github.com/StanleyLl0yd/FootballForecast/pull/297) real five-fold SELECT-only research was actually executed in [Actions #42994112402](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/42994112402), returning **aggregate-only SHA-256** `c9ef3e4bb37f70a451aa6c4bcb41dbe8d1a5c941543705b8c700d8e2514c2c98`, scored 1,197/1,200 candidates in 2020/21–2024/25 chronological validations with no same-year training.

## Acceptance boundary

Approving M3-A3 under the **revised retrospective-only cohort scope** enables A4/A5 candidate development comparisons. It does **not** authorize publishing any forecast, changing M2, using holdout 2025/26 again, introducing live pre-match claims, exposing private source data, or declaring original first-publication / individual kickoff UTC timestamps proven. Separate confirmed *as-of* inputs remain necessary before a real pre-match launch. Actual third-party restrictions are not waived, but hypothetical new licence letters are not milestone work.

Evidence is immutable and aggregate-only; the JSON companion and fail-closed tests must pass in protected exact-head and exact-main CI before changing M3-A3 from OPEN in #271. A4/A5/A6 and A8 have independent exit conditions.
