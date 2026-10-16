# API contracts

M0 exposes `/api/health` with only `service` and `status` (`public_configured` or `setup_required`). `public_configured` confirms valid-looking public Supabase endpoint settings, **not** actual REST reachability, imported records or forecasting readiness. External production canary independently checks rendered dashboard REST connectivity. Optional administrator OAuth is separate from public health.

The first draft is `packages/contracts/forecast-v1.schema.json`. Revisions must be backward-compatible where possible. Future job dispatch requires authenticated, role-gated Next route handlers, server-generated idempotency tokens, predefined workflows, authenticated worker completion, polling and immutable job history. Arbitrary shell commands and public data upload endpoints are forbidden.
