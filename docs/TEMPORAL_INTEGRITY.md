# Temporal integrity

A match result, lineup, injury or xG value is usable for forecast time **T** only if evidence supports availability by T.

Store at minimum: source ID, record ID, source version, event time, publication time (nullable), ingestion time and a content digest. Record provenance and match status separately. Historical data ingested today does not automatically prove that its present value existed at the claimed historical time.

Current M0 `SourceObservation.eligible` is intentionally conservative: it requires both publication and ingestion at/before cutoff for strict tests. This excludes retrospectively ingested data even when its publication date is known. M1 must implement separately documented as-of reconstruction using authenticated historical snapshots and source revision history before claiming long-range retrospective backtesting.

Never use post-match xG for the same pre-match prediction. Never allow published starting lineups after the prediction timestamp. Keep postponed and awarded matches distinct. Split train/validation/calibration/test chronologically; freeze test set and do not tune against it. A model trained with retrospectively corrected data must be labeled non-strict unless a historic record of those corrections exists.
