# M3-A3 · 1,200 five-season public/private date+score histogram reconciliation

**2026-11-10 · A3 remains OPEN / 2 of 8 · public-safe aggregate evidence.** Machine-checked [receipt](M3_FIVE_SEASON_DATE_SCORE_HISTOGRAM_EVIDENCE.json); tracked by [M3 #271](https://github.com/StanleyLl0yd/FootballForecast/issues/271).

## Why this is useful and what it does not prove

We independently fetched **five published source-CC0 Git blobs at already pinned blob SHAs** documented in [M2 reference shape](M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json): 2018/19, 2019/20, 2020/21, 2023/24 and 2024/25. Each contained 240 public score-bearing fixtures (total 1,200). The two absent CC0 archive paths for 2021/22 and 2022/23 remain unreviewed in this comparison, not evidence of missing football seasons.

Public-only in-memory parsing produced non-sensitive **date + directed final-score count bins**, without carrying club names into SQL. A single owner-authorized PostgreSQL `SELECT` joined those count bins to private provider history aggregated **inside the database** by `season, UTC-date of provider kickoff, provider final-goal pair`. Only **per-season sum/count/L1 aggregates** left the database. No private match ID, club ID, per-match private result, or source record was exported. Private tables, original CC0 blobs, the M2 model and 2025/26 were untouched.

| Season | Pinned public repo | Public score rows | Distinct date+score bins | Raw date+score L1 mismatch | Raw final-score histogram L1 |
| --- | --- | ---: | ---: | ---: | ---: |
| 2018/19 | `openfootball/football.json` | 240 | 221 | 0 | 0 |
| 2019/20 | `openfootball/football.json` | 240 | 221 | 0 | 0 |
| 2020/21 | `openfootball/football.json` | 240 | 219 | 0 | 0 |
| 2023/24 | `openfootball/europe` | 240 | 225 | 2 | 2 |
| 2024/25 | `openfootball/europe` | 240 | 227 | 0 | 0 |
| **Total** | Five pinned files | **1,200** | **1,113** | **2** | **2** |

Every season has exactly **240 private provider-finished matches** in the corresponding database snapshot, and count parity held. Four seasons have **exact equality** of all date+score frequencies (their count histograms), not independently authenticated record-level match correspondence.

### Isolated public 2023/24 archive direction mistake

At [pinned public 2023/24 blob](https://github.com/openfootball/europe/blob/63df627f3c87ce71708f016522ea236cf74332c3/russia/2023-24_ru1.txt), **line 113** of the source records *FK Sochi v Spartak Moskva 0–1* for **2023-09-16**. The separately documented [official Sochi/Spartak swap notice](https://pfcsochi.ru/news/2023-2024/rfs-i-rpl-soglasovali-perenos-matchey-mezhdu-sochi-i-spartakom/) and [RFS scheduled calendar](https://www.rfs.ru/tournament/1434/calendar?round_id=18568) identify the true home side as Spartak, and the public date+score shape would therefore be **Spartak v Sochi 1–0**. This known public error is different from a private dataset error.

A second read-only aggregate `SELECT` **simulated only that one public source reversal** (remove one public 2023-09-16/0–1 count; add one 2023-09-16/1–0 count) without changing either archive or the private database. It returned:
- Original public 2023/24 versus private: **240 vs 240**, date+score histogram L1 **2**, **2** differing bins.
- With exactly that one simulated public correction: **240 vs 240**, date+score histogram L1 **0**, **0** differing bins.

The same one-reversal scenario also reduces the season's whole-score histogram L1 from 2 to 0. This is **conclusive for the compared aggregate histograms**, not proof of a complete private-to-public per-match club identity map, independent played status, true first historical UTC kickoff, or original source publication time.

## Reproducibility and safe query shape

Public immutable Git blob IDs, file paths, formats, parsed row counts and bin counts are pinned in the JSON receipt. Parser specification:

- JSON seasons: read `matches[].date` and `matches[].score.ft[0:2]`, requiring exactly two non-negative integer final-goal values.
- Football.TXT seasons: parse full-year fixture day headings (`Fri Jul 21 2023`), inherited year on later headings (`Sat Jul 22`), and `Team A v Team B H-A` lines with optional half-time parentheses. Infer July–December from first year, January–June from second. **No fictional time for missing public clocks**.
- Group only by `(season, public_date, H, A)`, return integer counts. Validate 240 rows/season. For 2023/24 perform the single public correction **as a hypothetical second query only**, never modify any source.
- In protected SQL, group 2018/19–2024/25 private history **only for the five explicitly identified seasons**. Use `(kickoff_at AT TIME ZONE 'UTC')::date` and home/away goal columns exclusively inside SQL; compare to parameterized or strictly parsed fixed public count bins. `FULL OUTER JOIN` public/private count bins and aggregate `SUM(ABS(public_n-private_n))` per season; return only season, total counts, bin counts and L1.

The original provider timestamps are not independently authenticated; date-agreement can also reflect two publishers using the same upstream feed. The score histogram comparison is **not independent per-row external corroboration** of played goals. Publisher-declared CC0 does not independently clear all upstream permissions for model training. No public original source rows were inserted in private tables, and no automatic import was added.

A pure, no-I/O validator `ml/src/football_forecast/research/m3_public_private_histogram.py` validates the receipt against the pre-existing source shape evidence, exact file pins, five-season counts, simulated correction, privacy and denial flags. The tests reject arbitrary confidence escalation, archive edits, changed counts/SHAs and any 2025/26 or production-model claims. This guards reproducibility metadata but **cannot independently authenticate the SQL runtime**.

## What is next

1. Independently confirm all seven season match identities (including 2021/22 and 2022/23), not only histograms.
2. Separate completed-on-field results from technical awards and subsequently amended official results; include the RFS 2022/23 1–1 vs 0–3 case.
3. Verify original actual UTC match starts, original event/first-serving UTC and source training rights.
4. Review a restricted owner-only per-fixture eligibility and exclusion contract, then obtain confidential row-level evidence with **public aggregate receipts only**.

**M3 A3 remains unaccepted, zero independently certified private training rows (unknown eligibility, not proven absence), A4/A5 real runs prohibited.** No M2 or production changes.
