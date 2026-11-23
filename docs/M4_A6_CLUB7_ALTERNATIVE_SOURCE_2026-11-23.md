# M4-A6: official current-season replacement for pinned club source 7

Status: **candidate-only; source transport, content and KDK decisions remain unverified by protected worker** (23 Nov 2026). Refs #333, #304.

## Discovery and observed semantics

- Protected owner-only read-only run [#45182671616](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/45182671616) failed closed with exactly `PINNED_CURRENT_SEASON_CLUB_7_CAUSE_HTTP_403` from Spartak's broadcast URL. Six earlier pages reached digest validation; eighth was unattempted, not automatically successful. No eight-body receipt exists from that attempt.
- Replacement **home-club** report: https://dinamo-mx.ru/news/dinamo-sygralo-vnichyu-so-spartakom-2/ (FC Dynamo Makhachkala, dated 23 November 2026), explicitly describes the 22 November RPL round-15 match, home Dynamo Makhachkala vs away Spartak Moscow, 1:1; Zobnin at 14' and Lesovoy at 89'. Fixed exact HTTPS URL and publisher `dynamo_makhachkala` replace only source 7. The URL may still fail from GitHub Actions; public indexing cannot prove runner availability.
- Home club match page: https://dinamo-mx.ru/event/dinamo-mahachkala-vs-spartak-moskva-2/ (current season, round 15; match ended 1:1).
- Linked **RPL-branded match protocol №114**, six-page PDF hosted on the club's domain: https://dinamo-mx.ru/wp-content/uploads/2026/11/rpl_2026-2027_md15_dmh-spa_fr_ru.pdf. It lists 22 Nov 2026, 16:30 Moscow (13:30 UTC), directed club identities, 1:1 (HT 0:1), goals minutes 14 and 89, officials, and no protest filed as recorded at match time. This is positive on-field protocol evidence, **NOT** digitally validated league issuance, permanent official-result finality or later KDK no-change certification. Source content can change.
- RFS 19 Nov referee appointments https://www.rfs.ru/news/225626 are prematch corroboration only.

## Strict boundaries and next evidence gate

Only `CLUB_REPORTS` source 7 changes. The PDF is recorded separately in `MATCH_PROTOCOL_REFERENCES` and is **never fetched** by the existing HTML-only digest worker. No fallback/proxy/cookie/bot bypass, redirect following, widened URL discovery, dynamic parsing, body retention, results, migration or forecast enablement.

First independently review source/legal use, then require protected owner-only GitHub HTTP 200 `text/html` byte observation and GitHub RS256 raw digest for **all eight** exact URLs; review HTML semantics separately. Independently authenticate RPL protocols only through an explicitly reviewed and bounded protocol workflow; pin source bytes, identities and lineage. RFS KDK status is still unresolved: an empty archive search cannot attest no award or later revision. No A6 acceptance until #333 conditions are met.

No A5 immutable fixture changes, no other club source changes, sealed 2025/26 holdout access, live database write, private scoring, or public predictions.
