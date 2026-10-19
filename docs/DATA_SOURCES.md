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
| [TheSportsDB](https://www.thesportsdb.com/documentation) | Public [RPL 2026/27 catalog](https://www.thesportsdb.com/season/4355-russian-football-premier-league/2026-2027) identifies league **4355** and advertises **240 fixtures**, but this is website catalog evidence, **not a free-API dataset extraction or accuracy check** | [Terms updated 2026-09-17](https://www.thesportsdb.com/docs_terms_of_use.php) allow copying/modifying API-returned data subject to third-party rights; free API is described for *development projects*, with app-store publication restricted to paid subscribers. Website scraping forbidden | **Free current-season candidate, NOT APPROVED**: establish whether ongoing public web service, encrypted backup, ML training and derived predictions are permitted under free use; verify API caps, rate limits, actual league/season responses and rights independently |
| [Sportmonks](https://www.sportmonks.com/blogs/football-api-coverage-finder/) | Provider's RPL season/field coverage unconfirmed without account access | Subscription and distribution rights not verified | Deferred until an authorized coverage and licensing probe |
| Understat | RPL 2026/27 coverage/rights not verified | No permission for automated acquisition or redistribution established | No adapter or scraping |
| Official RPL / club sites | Public fixtures/results may be visible | Public visibility is **not** permission for bulk scraping or reuse of photographs, badges or protected databases | Reference only until a permitted feed/license is established |


## TheSportsDB free current-season investigation (2026-10-19)

- The public [RPL season catalog](https://www.thesportsdb.com/season/4355-russian-football-premier-league/2026-2027) advertises league ID `4355`, 16 teams and 240 events for 2026/27. **This is not an official RPL source or a verified API response.** Its displayed event statuses may be stale; neither the 240 count nor the scores have been independently reconciled.
- The [official free API guide](https://www.thesportsdb.com/docs_api_guide.php) documents a public v1 development key and `eventsseason.php`. The **free season endpoint advertises a limit of 15 events**, versus 3,000 on Premium. Therefore seeing 240 events on the website does **not** establish that a lawful, complete 240-event API response is accessible for free. Check specifically whether documented per-round or other free endpoints permit complete, rate-compliant retrieval before treating this as operational coverage.
- [Official terms, updated 2026-09-17](https://www.thesportsdb.com/docs_terms_of_use.php), explicitly distinguish API from website scraping; they allow API-returned content copying/modification *subject to third-party rights*, describe free access for development, prohibit app-store publication by free subscribers and separately restrict third-party logos/artwork. For this **public browser app**, ask the provider to confirm continued free production website use, fixture/result storage, offsite backup, permitted derived ML outputs and required attribution. Even if terms appear favorable, verify league/competition and imagery permissions rather than assuming the API vendor owns them.
- Neither observed catalog nor API documentation establishes source-published `as_of` timestamps, historical snapshot guarantees, or data accuracy. Verify independent result references and access before writing any adapter or storing any records.

**State:** discovered via published catalog/terms only. No account, paid subscription, automated website scraping, free-API bulk retrieval, import or training. Mark as a higher-priority candidate for explicit free-tier API/rights validation, **not** a chosen primary feed; #2 and M0 remain open.

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

## Reproducible OpenFootball M0 read-only quality snapshot (2026-10-19)

The inspected upstream revision is [`openfootball/europe@63df627f3c87ce71708f016522ea236cf74332c3`](https://github.com/openfootball/europe/commit/63df627f3c87ce71708f016522ea236cf74332c3). The following Git **blob SHA-1** values identify individual source files at that revision (they are not SHA-256 file checksums and not source-authenticity certifications).

| RPL season | `russia/*_ru1.txt` Git blob SHA-1 | Scheduled fixture rows | Technical `[awarded]` results | Mechanical observations |
| --- | --- | ---: | ---: | --- |
| 2018/19 | `e5efe22ce8ac11b76d0b8aa31527533a44d5a325` | 240 | 0 | 30 rounds of 8; 240 directed pairs |
| 2019/20 | `233597390aeb5b4cf4cd2a0a3279ae4fc6e02c68` | 240 | **4** | 30 rounds of 8; 240 directed pairs; only **236** ordinary score rows |
| 2020/21 | `272185a808d69ce90574e9eff40ff6d53bf7f322` | 240 | **2** | 30 rounds of 8; 240 directed pairs; only **238** ordinary score rows |
| 2023/24 | `3ea6829a971d1cbdf56552be0519cc125707bd99` | 240 | 0 | **FAIL**: 239 directed pairs, duplicate Sochi/Spartak and missing inverse |
| 2024/25 | `6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc` | 240 | 0 | 30 rounds of 8; 240 directed pairs |

The sum of recorded scores across each 240-row season is respectively **542, 583, 637, 637 and 648 goals** (2018/19 through 2024/25, in the order above). These totals agree with published independent season aggregates ([2018/19](https://en.wikipedia.org/wiki/2018%E2%80%9319_Russian_Premier_League), [2019/20](https://en.wikipedia.org/wiki/2019%E2%80%9320_Russian_Premier_League), [2020/21](https://en.wikipedia.org/wiki/2020%E2%80%9321_Russian_Premier_League), [2023/24](https://en.wikipedia.org/wiki/2023%E2%80%9324_Russian_Premier_League), [2024/25](https://en.wikipedia.org/wiki/2024%E2%80%9325_Russian_Premier_League)). This is **aggregate agreement only**: reversing a fixture and swapping its score can preserve a season total, as in the still-invalid 2023/24 dataset.

The six **administratively awarded** scores are explicitly marked in the original Football.TXT files: 2019/20 Orenburg–Krasnodar, Orenburg–Ural, Tambov–Sochi and Krylia Sovetov–Sochi; 2020/21 Rotor–Krasnodar and Rostov–Rotor. They count in *official competition results*, but they are **not observed played goal totals**. The [2019/20 results table](https://fbref.com/en/comps/30/2019-2020/schedule/) and [Rotor 2020/21 log](https://fbref.com/en/squads/257195fa/2020-2021/Rotor-Volgograd-Stats) independently describe some of these as awarded. This is a targeted check of classifications, **not** a full external reconciliation of 1,200 results.

**Policy:** preserve the official score/status for league tables, and separately exclude or explicitly model non-played awards in any future empirical goal-rate/Poisson fitting. Never silently turn an administrative 3-0 into three observed goals. The existing 2023/24 quarantine still applies independently. No model, data ingestion or production behavior changes here.

`scripts/m0-source-quality.mjs` adds a dependency-free, local-file-only diagnostics command:

```sh
node scripts/m0-source-quality.mjs /path/to/2019-20_ru1.txt
```

It checks 30 matchdays with 8 fixtures each, detects `[awarded]` outcomes, rejects unknown score annotations and impossible half-time/final-score combinations, and delegates duplicate/missing fixtures to the existing `auditFootballTxt()`. Output is JSON; it reports `mechanicalChecksPassed`, **never** `approved`. The CLI returns exit code 1 for mechanical failures and 2 for usage/read errors. CI uses **synthetic fixtures only** and never downloads upstream data. To reproduce historical observations, a maintainer must intentionally obtain the five CC0 files at the pinned upstream revision, validate their immutable blob identities independently, then inspect each local file. No provider records are committed.

**Git history is not historical data availability.** GitHub per-path history at the pinned upstream revision starts no earlier than **2025-03-27** for the three 2018/19–2020/21 files, **2025-03-22** for the 2023/24 file and **2025-03-22** for 2024/25; subsequent changes include a **2026-05-28** format update. The wrong 2023/24 Sochi/Spartak orientation is already present in the **2025-03-23** upstream snapshot. Therefore these repository histories cannot prove what was known before matches in their respective seasons, and a file commit date must **never** be substituted for a source-published pre-match timestamp. This also leaves underlying original-source and contribution provenance unverified.

The checked source includes match-day dates and scheduled kickoff text, **not independently validated actual kickoff timezones or pre-match publication timestamps**. For example, [FBref's 2023/24 fixture list](https://fbref.com/en/comps/30/2023-2024/schedule/) and [Russian 2023/24 schedule](https://www.rusfootball.info/matchcenter/tournaments/rpl/season_2023_2024/matches/113985) independently place **Spartak at home** against Sochi on 2023-09-16. These observations do not establish comprehensive source correctness, rights, a strict historical as-of dataset or permission to publish a public RPL fixture feed.

## Local match-by-match independent reference gate (M0)

`scripts/m0-fixture-reconcile.mjs` compares **each** Football.TXT fixture against a second, independently and lawfully obtained **local JSON Lines** reference file. It accepts exactly two local filenames and never retrieves external data or writes to Supabase:

```sh
node scripts/m0-fixture-reconcile.mjs /path/to/pinned-season_ru1.txt /path/to/independent-season.jsonl
```

Reference records must provide the *full* season's unique directed fixtures, one JSON object per line, with exact team names mapped **manually and transparently** to the Football.TXT spelling (no hidden fuzzy matching or auto-corrections). Minimal synthetic shape, **not an actual match**:

```json
{"date":"2027-01-01","home":"A Club","away":"B Club","homeGoals":1,"awayGoals":0,"resultType":"played"}
```

`resultType` is `played` or `awarded`; `date` is an ISO calendar date, **not** publication time or a timezone-aware kickoff. The comparator rejects missing/duplicate directed pairs, malformed references, conflicting scores, award flags, calendar dates and invalid/unanchored/weekday-contradictory Football.TXT dates. It includes the earlier round and fixture-structure quality gate and reports both file **SHA-256 hashes**, exact mismatch locations and a machine-readable `comparisonPassed` indicator. Exit codes: 0 for mechanically matched, 1 for mismatch, 2 for invocation/read failure. Unit tests are **synthetic only**.

**Independent provenance is not something code can infer from agreement:** record the actual second provider, license, extraction authorization, retrieved timestamp, original provider record IDs, the raw-reference SHA-256 and every explicit club-name mapping *outside this repository* before relying on a comparison. `comparisonPassed=true` expressly implies **neither** verified independence, legal clearance, strict pre-match `as_of` snapshots nor permission to import the files. For the quarantined 2023/24 season, do not silently reverse/repair the two Sochi/Spartak entries; the raw-source error must remain visible until independently resolved and an authorized correction is versioned.

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

For the public read-only RPL/Zenit prototype, continue the **offline CC0 source provenance/completeness review** of OpenFootball's discontinuous historical seasons; in parallel verify **TheSportsDB's documented free per-round API coverage and free production-use permissions** for RPL 2026/27 and independently reconcile the results. API-Football remains an alternative only after rights and available-season confirmation. Do not treat Football-Data.co.uk free research files as training rights, or select a paid plan or import data on assumptions. Do not select a paid plan or bulk ingest data on assumptions.
