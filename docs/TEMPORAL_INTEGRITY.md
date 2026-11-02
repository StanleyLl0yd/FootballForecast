# Temporal integrity

A match result, lineup, injury or xG value is usable for forecast time **T** only if evidence supports availability by T.

Store at minimum: source ID, record ID, source version, event time, publication time (nullable), ingestion time and a content digest. Record provenance and match status separately. Historical data ingested today does not automatically prove that its present value existed at the claimed historical time.

Current M0 `SourceObservation.eligible` is intentionally conservative: it requires both publication and ingestion at/before cutoff for strict tests. This excludes retrospectively ingested data even when its publication date is known. M2 must not claim long-range strict retrospective backtesting until separately documented as-of reconstruction exists using authenticated historical snapshots and source revision history. The pre-registered [M2 Poisson study](M2_BASELINE_PROTOCOL.md) explicitly labels the limited 2024/25-to-2025/26 design non-strict.

Never use post-match xG for the same pre-match prediction. Never allow published starting lineups after the prediction timestamp. Keep postponed and awarded matches distinct. Split train/validation/calibration/test chronologically; freeze test set and do not tune against it. A model trained with retrospectively corrected data must be labeled non-strict unless a historic record of those corrections exists.
