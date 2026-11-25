# M4-A6: historical receipt trust boundary (proposal)

No live archive, approved archive authority, historical verifier, worker,
migration, write or source fetch is introduced here. A6–A8 remain OPEN.

## Distinct clocks and evidence

* The live verifier must retain PyJWT's real wall-clock expiry, issued-at
  and not-before validation. The supplied verification time must also fall
  inside the signed validity window (existing five-second skew policy).
  Neither a caller-selected old clock nor a stored JWT revives an expired
  token on the live path.
* The original verification instant is when trusted protected code actually
  performed successful live signature and identity validation. It is not
  JWT iat, an observation time, or SQL recorded_at. The current insert guard
  allows issuance up to 20 minutes before recording; that timestamp alone
  cannot establish validation before expiry.
* Historical verification is retrospective signature/identity/time
  validation against the originally authenticated archive. It is not new
  live evidence or an assertion that publisher claims are true today.

## Required archival contract before implementation

A protected archiver must independently authenticate issuer discovery and
JWKS through the existing fixed HTTPS issuer, and retain their exact bounded
bytes and SHA-256, retrieval time, issuer, selected public key fingerprint
and key identifier. Do not trust JWKs taken from a receipt, arbitrary URLs,
current JWKS for a retired key, or a historical key supplied by a reviewer.
The archive must preserve key rotation history and reject ambiguous key IDs,
wrong issuer, unexpected algorithms or missing provenance.

For each successful live verification the archive must bind, in one
versioned canonical record:

* exact token digest, expected audience, manifest/body digests and receipt
  type; actual original observed and verified UTC instants;
* immutable capture/observation identity, repository/workflow/ref,
  environment, run/attempt and reviewed code SHA; selected key fingerprint,
  authenticated discovery/JWKS digest and immutable archive record identity;
* verifier policy/version, protected archiver identity and independently
  trusted time/integrity anchor covering the entire record.

An anchor must be committed contemporaneously, with its own trusted UTC
time and a bounded delay consistent with original token validity. Use a
separately approved integrity-protected append-only archive or equivalent
signed timestamp service. Its trust roots, writer isolation, clock policy,
revocation/compromise handling, read verification and retention policy must
be independently provisioned and reviewed. Neither self-signed arbitrary
keys nor an ordinary row containing a claimed verification time count as
an anchor. Existing ledger rows cannot be retroactively promoted by
inserting a claimed timestamp. SQL immutability alone does not prove a
writer actually verified a signature. No archive trust root is selected or
authorized by this proposal.

## Future separate historical path

Only after authentication of the archive anchor and exact record linkage,
verify the retained JWT signature with the selected archived key, recompute
expected audience from exact retained bytes and validate all pinned claims
using the archived original time and the original reviewed policy. Do not
trust timestamps parsed from the token as the verification clock. Verify
the anchor's time and the record's time relationships, reject unsupported
policy versions and missing or ambiguous historical provenance. If raw
publisher bytes are unavailable, independent parsing is unavailable; do not
claim it succeeded. Check the complete batch, provider receipts, capture
lineage, latest revisions and separate KDK evidence independently.

Do not add a historical flag, caller clock override or disabled expiry to
the live verifier. No historical validation result may enter the live
append or admission path or authorize settlement, scoring, model approval,
publication or holdout access. Missing or untrusted archival evidence
requires a blocked/unknown outcome, not fallback to raw-only receipts.
Historical signature validity does not supersede current corrections or
prove final administrative result.

## Acceptance tests required before operational use

Use synthetic keys and records only until a separately approved archive is
available. Cover expired-now but valid-at-anchored-time historical receipt;
live rejection of the same JWT even with a historical caller clock; expired
at original verification; untrusted, altered, missing or late anchor;
substituted JWT, manifest, identity, policy, key or JWKS; duplicate key IDs,
rotated/retired keys, compromised trust roots and cross-run/fixture replay.
Test historical/live type and admission separation, rollback and
append-only enforcement, and absence of token/body/JWK logs. An archived
result must not change any existing authority flag. Run all repository CI
gates. No live migration or real write without separate owner approval.
