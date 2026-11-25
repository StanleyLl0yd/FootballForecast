# M4-A6 protected worker preparation (2026-11-25)

Candidate-only, no workflow dispatch, new fetch authority or live write. See
[M4 practical standard](M4_A6_PRACTICAL_RESULT_EVIDENCE.md) and
[private ledger](M4_A6_PRIVATE_EVIDENCE_LEDGER.md).

## Context-bound official witness receipt

The existing owner club digest probe signs only raw body SHA-256 and discards
the body and per-source JWT. Its aggregate is not a reusable evidence bundle.
Do not reinterpret those receipts as authenticated parsed semantics.

The pure `prepare_official_witness_bindings` function first calls the existing
practical structural gate, then checks exact bounded bytes against each
claimed digest. It prepares one distinct, deterministic audience per witness:
`ff-m4-2026-27-official-witness-context-v1-sha256-` plus the SHA-256 of its
canonical ASCII JSON manifest. The manifest commits the A5 fixture identity,
both provider claims, complete official witness set, pinned locators,
observed UTC times, directed scores, full-time events and counted goals,
and the receipt publisher. Witness order is canonical. The function
does not issue or verify a JWT; its output explicitly denies all attestation
and authority. A later protected verifier must recompute the manifest from
independently parsed retained bytes and verify the exact audience and
protected repository/workflow/environment/SHA/run/attempt with trusted GitHub
JWKS. A signature still proves only the protected runner's commitment, not a
publisher signature or original first-serving time.

## Prerequisites for an actual worker

| Gate | Required evidence / refusal |
| --- | --- |
| Source permission | Exact provider/club/protocol/KDK endpoints, terms or documented permission for bounded automation, private retention and analysis; unclear scope denies the source. No new requests under this PR. |
| Provenance | Original publisher and independent editorial authorship or actual league-issued protocol; no inference from distinct domains or hashes alone. |
| Parser | Source-specific, reviewed extraction of current fixture identity, actual play/full time and directed running goal scores from retained bytes; reject missing or contradictory fields, redirects and mixed-season content. No arbitrary URL input. |
| KDK | Separate dated manifest of reviewed archive pages and issued decisions with exact hashes, scope, identity and disposition. Known agenda fixtures remain pending until issued decisions; a generic search or the passing of 26 November is insufficient. |
| Isolation | Dedicated reviewed owner-only workflow and restricted credential scope; no public API, artifact or raw source/JWT/score logging. No holdout access. |
| Retention | Private approved storage of permitted raw bodies, canonical manifest, verified receipt and signing key provenance; recheck digests on read. Do not store raw content until rights and retention rules are established. |
| Ledger | Verify exact A5 capture and latest eligible FORECAST, lock capture, append observations and blocked/unattested candidate revisions, verify returned cutoff and lineage. All flags false; separate approval for migration and any live write. |

The canonical manifest format is a proposal, not a live receipt format.
SQL 0017 currently stores raw-body hashes and tokens, not the canonical
manifest itself: a reviewed private storage and retrieval design is still
required. Prior aggregate digests cannot reconstruct the original bytes or
per-source tokens. No changes to OIDC workflow allowlist or production
database, no new fetching code, no actual settlement/scoring. A6–A8 OPEN.
