# RPL data sources and license decision register

Preliminary public-source review performed 2026-10-16. No API key was supplied; no authenticated coverage probes performed. **Approval status for every source: UNVERIFIED.** No automated import or training authorized yet.

| Source | Publicly verified coverage | Permission / limitation | Next verification |
|---|---|---|---|
| Football-Data.co.uk | Russian league through 2025/26; explicitly discontinued later | Data described as free for analysis; long-term storage, derived commercial rights and publication require review | Read data acknowledgments/terms and obtain clarification if needed |
| FootyStats | RPL 2026/27 and historical seasons at least through 2015/16 shown in catalog | Site terms prohibit scripted scraping; API expressly excluded from this prohibition, but API license/storage rules must be checked | Test paid/free API historical match, player and xG fields; obtain API terms |
| API-Football | Russian Premier League listed in coverage; free tier advertises 100 calls/day with historical-season limits | API terms prohibit direct resale and explicitly do not grant third-party competition publication rights | Check exact fixtures/statistics endpoints and seasons under plan; rights for private retention |
| Sportmonks | Global coverage; Coverage Finder requires login; specific RPL seasons/fields unconfirmed | Subscription and field access depend on league/add-ons; redistribution rights require written review | Explore Coverage Finder under authorized account |
| Understat | Not verified for RPL 2026/27 (public page not reachable in research tool) | No reliable license confirmation for automated scraping or redistribution | Obtain official access/terms before writing adapter |
| Official RPL / club sites | Official results, schedules in principle | Public availability is not equivalent to a grant for bulk automated ingestion | Examine robot policy, license, permitted API/feed; no scraping before permission |

Evidence:
- Football-Data Russia: https://football-data.co.uk/russia.php
- FootyStats catalog: https://footystats.org/russia/russian-premier-league/datasets
- FootyStats terms: https://footystats.org/terms-and-conditions
- API-Football coverage: https://www.api-football.com/coverage
- API-Football pricing: https://www.api-football.com/pricing
- API-Football terms: https://www.api-football.com/terms
- Sportmonks coverage checker: https://www.sportmonks.com/blogs/football-api-coverage-finder/

## License/quality acceptance gate (M1)

1. Verify exact allowed automated access, storage period, and derivative analytics display for **private** use, then reassess for any future public/commercial use.
2. Compare available RPL seasons 2015/16–2026/27, match IDs, teams, raw events, xG and publication/ingestion timestamps.
3. Collect test samples only after the permissions gate, validate historical changes and timestamp semantics.
4. Never blend providers' incompatible xG without documented normalization.
5. No synthetic statistics, no scraping the FootyStats website; API only subject to its separate terms.
6. Historical testing may use only fields known to exist at forecast cutoff, or clearly mark diagnostics exploratory.

Recommendation: investigate API-Football's lawful private use as primary current-fixture candidate and Football-Data for historical results only after terms check. FootyStats API remains a promising coverage fallback, not an approved source.
