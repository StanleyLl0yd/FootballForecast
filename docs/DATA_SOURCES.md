# RPL data-source decision register (M0)

Updated 2026-10-19. This is a **public documentation and terms review**, not a provider contract or an authenticated API coverage test. Every source stays **UNAPPROVED**; automatic ingestion/training remains disabled. Provider terms can change.

## Candidate decision table

| Provider | Public coverage evidence | Permissions established from published terms | Current decision |
| --- | --- | --- | --- |
| [OpenFootball Europe / Russia](https://github.com/openfootball/europe/tree/master/russia) | Checked repo tree lists RPL top division files **2018/19, 2019/20, 2020/21, 2023/24, 2024/25**; 2023/24 and 2024/25 file headers claim **16 teams / 240 matches** | Project repo [CC0-1.0](https://github.com/openfootball/europe/blob/master/LICENSE.md) for its published data; the contribution chain, original facts, fixture corrections and third-party competition/trademark rights have not been independently reviewed | **Highest-priority FREE historical candidate (NOT APPROVED)**. No 2021/22, 2022/23, 2025/26 or current 2026/27 top-tier files in verified tree; no trusted as-of history, xG or live refresh guarantee |
| [Football-Data.co.uk](https://football-data.co.uk/russia.php) | Russian CSV history ends at **2025/26**; provider explicitly discontinued Russia for subsequent seasons | [Fair data usage policy](https://football-data.co.uk/contact.php) states free files are for private personal betting/academic interest, permits at most light automated access (twice/week), and **does not intend** heavy commercial or model-training downloads | **Manual/private research only unless owner obtains explicit authorization**; not a 2026/27 feed, not approved as training or public redistribution source |
| [FootyStats website](https://footystats.org/russia/russian-premier-league/datasets) | Catalog lists RPL seasons **2013/14–2026/27**, with 240 fixture rows for many seasons; this establishes displayed catalog coverage, **not paid API entitlements or field quality** | [Website terms](https://footystats.org/terms-and-conditions) prohibit automated site crawling/extraction; explicitly except their distinct API service | **No automated site access, ever without written exception** |
| [FootyStats API](https://footystats.org/api) | [API match endpoint](https://footystats.org/api/documentations/match-schedule-and-stats) supports league season IDs and a `max_time` query parameter; API's public free tier advertises Premier League (England) only, not RPL | [Separate API terms](https://footystats.org/api/documentations/terms-of-use-and-legal) allow building websites/apps and models, but prohibit resale/redistribution of the raw API or data. Images/logos remain rights-controlled | **Promising candidate**, not approved: verify a plan containing RPL, historical fixture and xG fields, timestamps, storage/retention and downstream rights before subscribing/importing |
| [API-Football](https://www.api-football.com/coverage) | Lists competition coverage; no authorized field-by-field or season-range check made | [Provider terms](https://www.api-football.com/terms) allow projects such as apps, but explicitly state they **do not grant competition-data publication licenses** and leave third-party rights clearance to users | **Current fixture candidate**, not approved: confirm plan coverage, private storage and league intellectual-property restrictions with provider/rights holders |
| [Sportmonks](https://www.sportmonks.com/blogs/football-api-coverage-finder/) | Provider's RPL season/field coverage unconfirmed without account access | Subscription and distribution rights not verified | Deferred until an authorized coverage and licensing probe |
| Understat | RPL 2026/27 coverage/rights not verified | No permission for automated acquisition or redistribution established | No adapter or scraping |
| Official RPL / club sites | Public fixtures/results may be visible | Public visibility is **not** permission for bulk scraping or reuse of photographs, badges or protected databases | Reference only until a permitted feed/license is established |


## Public-domain RPL candidate, observed 2026-10-19

`openfootball/europe` declares the repository's datasets CC0-1.0 and has an actual `russia/` directory; this was verified directly from the repository tree, not inferred from a generic football.json catalog. The top-division file names found were:

| Season | Repository file | Status |
| --- | --- | --- |
| 2018/19 | `russia/2018-19_ru1.txt` | 240 scored matches, 16 teams, 240 distinct ordered home/away pairs in preliminary scan |
| 2019/20 | `russia/2019-20_ru1.txt` | 240 scored matches, 16 teams, 240 distinct ordered home/away pairs in preliminary scan |
| 2020/21 | `russia/2020-21_ru1.txt` | 240 scored matches, 16 teams, 240 distinct ordered home/away pairs in preliminary scan |
| 2023/24 | `russia/2023-24_ru1.txt` | 240 score rows, 16 teams but **239 distinct ordered home/away pairs**: one duplicate, one missing reverse fixture; FAIL independent structural check |
| 2024/25 | `russia/2024-25_ru1.txt` | 240 scored matches, 16 teams, 240 distinct ordered home/away pairs in preliminary scan |

**Important source integrity failure (found by direct inspection, 2026-10-19).** An offline read-only scan of the five original Football.TXT sources matched each of the 240 stated fixture lines, parsed score and teams, and counted home/away pair uniqueness. All five have 16 team names and 240 score rows. Four seasons have 240 unique ordered fixtures; **2023/24 has only 239**. The September 16, 2023 line in the upstream file says `FK Sochi v Spartak Moskva 0-1`; the same pairing reappears April 13, 2024 as `FK Sochi v Spartak Moskva 1-0`. It thereby lacks `Spartak Moskva v FK Sochi`. An [independent match log](https://fbref.com/en/squads/8c635914/2023-2024/matchlogs/c30/schedule/Spartak-Moscow-Scores-and-Fixtures-Russian-Premier-League) lists September 16 as **Spartak's home match**, 1-0 vs Sochi. This likely reflects a copied home/away reversal plus inverted score on the September line. That repair is **not applied** to the external source or our production data. Quarantine 2023/24 pending independent fixture-by-fixture reconciliation and explicit source correction; do not silently patch the result in the model pipeline. The other four seasons pass only *structural row uniqueness*, not validated external factual accuracy or true point-in-time provenance.

**Not continuous.** The checked upstream tree contains no listed top-division files for 2021/22, 2022/23, 2025/26 or 2026/27. No validated feed for this season emerges from CC0 alone. The sampled Football.TXT 2024/25 file records match dates, clubs, scores and some half-time scores; it does not demonstrate trustworthy pre-match source-publication timestamps, injury/lineup histories or xG for chronological forecasts. The 240-row and 240-ordered-fixture properties above are independently counted from the repository text, but that does **not** prove factual correctness, rights of upstream contributors or temporal provenance.

Before approving for any import: freeze an exact upstream commit and raw SHA-256, audit any original-source attribution/third-party database rights, parse all candidates independently, check 240 unique fixtures per applicable season, team identities, schedule/score contradictions, historical corrections and independent match reconciliation. Training must be marked *retrospective without point-in-time guarantee* unless timestamp provenance is demonstrated. Never conflate public-domain repo licensing with rights to club logos or league-owned media.

Unlike free-claim APIs with ambiguous retention and competition publication rights, this CC0 dataset is worth prioritizing for **offline research first**, but is not an authorized current RPL fixture source and cannot on its own close M0 issue #2. No Git clone, scraping, automatic download, production database seed, model training or license-status change was made by this review.

## Reusable offline structural gate

`scripts/m0-fixture-structure.mjs` exports a pure `auditFootballTxt()` function that inspects match rows, header team/match counts, malformed or negative scores, 16 distinct clubs, all 240 directed home/away pairs and any duplicate/missing inverse. Required web CI runs synthetic positive/negative unit fixtures; **it never fetches vendor data**. This is a safety gate for evaluating a manual candidate **before** any M1 approval, not an importer, validator of legal provenance or authorization to use live/paid data. A passing structural audit is necessary but not sufficient to approve any provider.

## Two important distinctions

1. **Website != API.** FootyStats explicitly directs programmatic use to its API, and the API has different conditions from the website. API model/app permission does **not** authorize publishing a copy of the vendor's dataset or third-party team assets.
2. **Historical API parameter != historical evidence.** FootyStats `max_time` limits returned statistics to a specified time according to API documentation. Before treating it as an as-of snapshot, independently test whether historical corrections, match publication times, lineups, injuries and xG were actually available at that cutoff. Otherwise label experiments retrospective/non-strict.

## M0 source gate still open

A provider may enter `approved` in `ff_sources` **only** after documenting all of:

- Allowed authenticated automated collection, API plan/cost/quota, RPL seasons (2015/16 through current), fixture identities, required fields and accurate source IDs.
- Allowed private retention, backups, model training, derived forecast displays, and future public/commercial distribution if intended; clarify competition/club/image rights separately.
- Actual samples collected through an authorized API, reconciled with independently verified fixtures, checked for duplicates, invalid postponed/awarded cases and historic corrections.
- **Provenance**: event time, provider-published time (if genuinely available), ingestion time and revision hashes. No backdated access inferred merely because data were downloaded later.
- Explicit cost approval from the owner before any paid account/plan; no credentials in public Git, chats or issue comments.

Until then: **zero provider adapters active, zero imported matches, zero trained models and zero real predictions**. Source changes should be recorded in this register, not in a repetitive README status log.

## Free-tier fact check (2026-10-17)

- [API-Football pricing](https://www.api-football.com/pricing/) advertises a $0 plan with **100 API requests/day** and all competition/endpoint categories, **but with available-season limitations**. Actual RPL 2026/27 fixture data, historical depth and field completeness have not been probed through an authorized account.
- [API-Football terms](https://www.api-football.com/terms) permit creating apps/websites and prohibit data resale. They explicitly say the API subscription **does not grant competition-data publication rights**; league/club and third-party permissions remain the developer's responsibility. Free API access cannot automatically authorize public raw-data republishing or ML redistribution.
- [football-data.org coverage](https://www.football-data.org/coverage) includes Russia / RFPL among **all competitions**, but RFPL is **not** in the provider's listed Free tier. [Pricing](https://www.football-data.org/pricing) separately restricts historical season/model fields to paid tiers. Do not assume the Russian league can be obtained under its €0 plan.

No provider registration, data import or payments were performed by this terms review. All sources remain **unapproved**.

## Next decision

For the public read-only RPL/Zenit prototype, first complete an **offline CC0 source provenance/completeness review** of OpenFootball's discontinuous historical seasons; then investigate a separately licensed/authorized current 2026/27 RPL feed through provider plan tools. Do not treat Football-Data.co.uk free research files as training rights, or select a paid plan or import data on assumptions. Do not select a paid plan or bulk ingest data on assumptions.
