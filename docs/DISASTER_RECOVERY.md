# Disaster recovery (unimplemented plan)

M0 has no provisioned database or backups. Before publishing forecasts: document database export cadence, object-store versioning, encryption, separate access and retention, restore test schedule, recovery point/time objectives and key rotation. The immutable ledger requires snapshots and independently verified hashes, not only a single live SQL database. Failures in import, model training or API access must never overwrite the last known-good model or historical forecast revisions.
