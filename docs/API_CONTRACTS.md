# API contracts

M0 exposes `/api/health` with only `service` and `status` (`configured` or `setup_required`). It does not validate data/provider connectivity and must not be used as proof of production readiness.

The first draft is `packages/contracts/forecast-v1.schema.json`. Revisions must be backward-compatible where possible. Future job dispatch requires authenticated, role-gated Next route handlers, server-generated idempotency tokens, predefined workflows, authenticated worker completion, polling and immutable job history. Arbitrary shell commands and public data upload endpoints are forbidden.
