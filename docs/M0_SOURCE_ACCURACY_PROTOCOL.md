# M0: empirical free-source accuracy protocol (offline, no ingestion)

This document implements the owner's **strict $0 and multi-source quality policy** from [DATA_SOURCES.md](DATA_SOURCES.md) and the [18-source registry](M0_FREE_SOURCE_REGISTRY.json). All M0 providers are inactive and remain unapproved for live data ingestion, training, redistribution and production use.

## What is measured

`scripts/m0-multi-source-quality.mjs` reads a **locally supplied, privately reviewed JSON file only**. It has no HTTP client, scheduled execution, paid credentials, Supabase access or production write path. A source ID must already appear in the inactive free/public research registry. Reference match evidence is represented by an HTTPS URL and a dated canonical match observation. **The CLI cannot independently authenticate that URL, inspect its contents or grant data rights.**

For each candidate, it separately measures:

- **coverage**: observed and missing matches among the same reference match IDs;
- **home/away orientation**: count of matches with incorrect clubs in home/away roles;
- **kickoff**: disagreement with the canonical kickoff timestamp;
- **status**: played / awarded / postponed / cancelled disagreement;
- **final score**: error rate **only** when the club orientation is correct and both matches have the same completed status; mismatched orientation or status cannot hide as a valid score comparison;
- **complete fixture integrity**: every finished canonical match is in the **same denominator for every observed source**; missing matches, reversed home/away, wrong kickoff, status or final score each count as an incorrect fixture (counted once); separate conditional field metrics remain available;
- **source dependence**: declared upstream publisher groups and unknown-provider count, without claiming independent origin;
- **temporal evidence**: only timestamps both published and actually observed no later than the source-specific kickoff can support historical pre-match availability. Modern snapshots never backdate themselves.

The local input contains a **single selected observation/revision per source per fixture**. Repeat versions require explicit separate date-versioned research files; duplicates fail rather than posing as independent votes.

## Input contract

A minimal **entirely synthetic**, *not real RPL* JSON example:

```json
{
  "schemaVersion": 1,
  "cases": [
    {
      "key": "synthetic-001",
      "officialEvidenceUrl": "https://example.org/fictional/001",
      "official": {
        "homeId": "Club-A",
        "awayId": "Club-B",
        "kickoffAt": "2025-01-01T12:00:00Z",
        "status": "played",
        "homeGoals": 2,
        "awayGoals": 1
      },
      "observations": [
        {
          "sourceId": "footbolno",
          "publisherGroup": null,
          "publishedAt": null,
          "observedAt": "2026-10-19T12:00:00Z",
          "homeId": "Club-A",
          "awayId": "Club-B",
          "kickoffAt": "2025-01-01T12:00:00Z",
          "status": "played",
          "homeGoals": 2,
          "awayGoals": 1
        }
      ]
    }
  ]
}
```

Set unverified publisher identity and publication timestamp to JSON `null`; do not infer them. Kickoff is exact UTC with seconds. Postponed and cancelled games must have both goals `null`. Awarded results are a **different** status from played and must be separated in comparisons. The input must fit 4 MiB, at most 20,000 primary observations with 64 provider observations per match.

Run only on a **separately curated private file**, after independently checking its acquisition permissions:

```sh
node scripts/m0-multi-source-quality.mjs /absolute/path/to/private-evidence.json
```

The output contains source IDs, counts, field-specific error rates, 95% Wilson intervals, a digest of supplied JSON and **explicit false flags** for authenticity, rights, independence and training. It does not include team IDs, source match rows or private paths. Do not commit the evidence file, vendor data, tokens or unapproved third-party datasets; use a private local working directory.

## Ranking and limits

A field-specific leaderboard is emitted only for candidates with **at least 30 comparable field observations** (an arbitrary minimum descriptive threshold, *not* a statistical certification). The **complete fixture integrity** ranking uses the same finished-match reference denominator (including missing/incorrect cases), preventing a sparse provider from looking perfect by dropping failed fixtures. Conditional score/kickoff/status rankings can still use different covered-match samples and be biased. Even at 240 comparisons, Wilson intervals can overlap; no definitive accuracy winner follows without paired comparisons and uncertainty accounting. Empty/unavailable data produce **no numerical accuracy rank**.

The preliminary source priority of official RFU/RPL/club documents, OpenFootball/Footbolno and other lawful free corroborators remains a **research priority**, not a statistical accuracy estimate. Official match evidence should be checked for original primary-document provenance, corrections, timing and possible contradictions before counting as an accepted reference. Never double-count mirrors of ESPN or the same federation bulletin as independent verification. In the event of conflicting official documents, quarantine the case rather than deciding by majority.

This is a **retrospective source accuracy measurement only**, not an ML backtest: modern availability of final scores does not prove what was known before an old match. Raw historical backtests require independently authenticated pre-match snapshots and source rights as specified in [TEMPORAL_INTEGRITY.md](TEMPORAL_INTEGRITY.md).

## Required external evidence to begin a real rating

1. Legal scope confirmed for private acquisition of each source and intended downstream use, with no paid plans; no bot evasion or prohibited scraping.
2. Date-pinned and individually reviewed official RFU/RPL or club protocol match references, including postponement/awarded rules and documented corrections.
3. A lawful, private, date-frozen snapshot for each candidate with its own exact raw byte hash and original publication metadata where available.
4. Matching competition/season/match IDs and home/away team identity, with disputed rows quarantined.
5. A bounded, representative sample shared across sources. Declare excluded/missing cases and upstream links; compare paired mismatches with confidence intervals and error categories.
6. Independent review of any claimed rights to retain records, use ML outputs or publish derivative forecasts.

**Current M0 state:** only synthetic unit cases have been run. No downloaded source was scored with official match-level references; no provider's true measured accuracy, legal approval, ML calibration or predictive performance is claimed. M0 and issue #2 remain OPEN.
