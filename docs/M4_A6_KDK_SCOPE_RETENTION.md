# M4-A6: separate private KDK scope retention (proposal)

Unapplied 0017 only; no migration, live writes, publisher fetch, new role,
raw body storage, cryptographic verification, settlement or scoring.

The optional separate `kdk_scope_manifest` bytea retains exact bounded
metadata bytes (2–32768) under the existing `kdk_scope_sha256` digest.
It is not the official witness manifest. SQL links its claimed current-round
A5 identity, dated scope, archive body digest and locator, document dates,
decision references and conservative classification. V1 is explicitly
incomplete: its only allowed row states are pending, ambiguous/unreviewed
or adverse. A positive no-adverse claim cannot include a v1 manifest.
Once any such manifest is retained, a later raw-only no-adverse claim
for that capture is also refused under the capture lock. Existing raw-only
structural fixtures are not an operational fallback.

SQL validates metadata structure only, not canonical serialization, issuer
keys, signed audience, publisher identity, actual document contents,
coverage, case linkage, source rights or legal effect. A future protected
worker must separately validate all of these, and cannot treat V1 as
clearance. The existing source JWT column remains a raw-body receipt
proposal; a separately reviewed context-bound receipt storage contract is
required before a protected worker can admit these manifests. No new
authorization flags, API or query access. All relevant A6–A8 gates remain
open. Synthetic PG17 tests are required; no real result data.
