# M4-A6: private context receipt retention proposal

Source-controlled, unapplied 0017 only. No production migration, fetch, source
rights approval, raw-body retention, new role, live worker or settlement.

The private observations table retains optional exact manifest bytes
(bytea, at most 32 KiB) and SHA-256 beside the existing raw-body digest,
runner JWT, JWT digest, signing JWK, issued time and run identity.
Both manifest fields must be present together. JSONB reserialization is
NOT the receipt's byte encoding. The protected caller must use canonical
bytes from prepare_official_witness_bindings, independently parse permitted
source bytes, recompute and verify the exact audience. No raw HTML/PDF in
this table; no new access paths.

SQL performs structural linkage checks for A5 identity, route, publisher,
locator, body digest, claimed score, full-time events and counted goals.
Protocol publisher label in the manifest is rpl_protocol:<source_fixture_ref>;
the row publisher remains rpl. For a context-bound candidate both selected
club witnesses must share the same JSON context except receiptPublisher.
Mixed raw/context pairs and mismatching selected provider metadata fail.
Once any context is retained for a capture, a positive raw-only candidate
is refused even through a different publisher/route. Raw-only structural
candidates for captures with no retained context remain explicitly
UNATTESTED, never an operational fallback. The future worker must require contextual receipts.
SQL does not verify cryptography, canonical encoding, trusted key provenance,
source authenticity, parsing, editorial independence or rights. The v1
manifest commits provider claims/digests, not their exact JWTs or IDs.
The worker must independently verify actual selected provider receipts.

## Remaining storage and revalidation gates

Obtain explicit rights for bounded requests, private retention and analysis.
If raw retention is disallowed, do not store bodies or claim reproducible
parsing. Design a separate restricted body store with digest addressing,
size/expiry policy, no public URLs, overwrites, body/JWT logs or public
artifacts. No such store is authorized here. Missing bytes make independent
review unavailable, never implicitly valid.

The live verifier checks current JWT expiry. See the [historical receipt trust boundary](M4_A6_HISTORICAL_RECEIPT_VERIFICATION.md). Historical verification needs
a separate reviewed path anchored to immutable original verification time
and trusted archived GitHub key provenance, not an option disabling expiry
for fresh evidence. A stored JWK or caller clock is not independently trusted.
KDK scope manifests, issued decisions, source-specific parsing, protected
worker isolation and separate owner approval for live migration/write remain
mandatory. Disposable PG17 tests use fake JWTs and synthetic JSON, testing
structural consistency only. A6–A8 OPEN.
