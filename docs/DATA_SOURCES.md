# RPL data-source decision register (M0)

Updated 2026-10-16. This is a **public documentation and terms review**, not a provider contract or an authenticated API coverage test. Every source stays **UNAPPROVED**; automatic ingestion/training remains disabled. Provider terms can change.

## Candidate decision table

| Provider | Public coverage evidence | Permissions established from published terms | Current decision |
| --- | --- | --- | --- |
| [Football-Data.co.uk](https://football-data.co.uk/russia.php) | Russian CSV history ends at **2025/26**; provider explicitly discontinued Russia for subsequent seasons | Files described as free; retention, programmatic use and derivative/publication rights have not been independently agreed | **Historical results candidate only**. Not a 2026/27 feed; no ingestion until rights and timestamp properties are checked |
| [FootyStats website](https://footystats.org/russia/russian-premier-league/datasets) | Catalog lists RPL seasons **2013/14–2026/27**, with 240 fixture rows for many seasons; this establishes displayed catalog coverage, **not paid API entitlements or field quality** | [Website terms](https://footystats.org/terms-and-conditions) prohibit automated site crawling/extraction; explicitly except their distinct API service | **No automated site access, ever without written exception** |
| [FootyStats API](https://footystats.org/api) | [API match endpoint](https://footystats.org/api/documentations/match-schedule-and-stats) supports league season IDs and a `max_time` query parameter; API's public free tier advertises Premier League (England) only, not RPL | [Separate API terms](https://footystats.org/api/documentations/terms-of-use-and-legal) allow building websites/apps and models, but prohibit resale/redistribution of the raw API or data. Images/logos remain rights-controlled | **Promising candidate**, not approved: verify a plan containing RPL, historical fixture and xG fields, timestamps, storage/retention and downstream rights before subscribing/importing |
| [API-Football](https://www.api-football.com/coverage) | Lists competition coverage; no authorized field-by-field or season-range check made | [Provider terms](https://www.api-football.com/terms) allow projects such as apps, but explicitly state they **do not grant competition-data publication licenses** and leave third-party rights clearance to users | **Current fixture candidate**, not approved: confirm plan coverage, private storage and league intellectual-property restrictions with provider/rights holders |
| [Sportmonks](https://www.sportmonks.com/blogs/football-api-coverage-finder/) | Provider's RPL season/field coverage unconfirmed without account access | Subscription and distribution rights not verified | Deferred until an authorized coverage and licensing probe |
| Understat | RPL 2026/27 coverage/rights not verified | No permission for automated acquisition or redistribution established | No adapter or scraping |
| Official RPL / club sites | Public fixtures/results may be visible | Public visibility is **not** permission for bulk scraping or reuse of photographs, badges or protected databases | Reference only until a permitted feed/license is established |

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

For the public read-only RPL/Zenit prototype, investigate the **FootyStats API** and **API-Football** through their authorized plan/coverage tools; compare legally usable fixture history and as-of evidence first. Historical Football-Data CSV may complement a licensed current feed only after separate terms and timestamp checks. Do not select a paid plan or bulk ingest data on assumptions.
