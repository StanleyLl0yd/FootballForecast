-- Verify the named indexes also cover their intended single-column FKs.
-- pg_index.indkey first attribute must be the correct FK column.
\echo 'Verifying matches FK indexes'
select 1 / case when count(*)=3 then 1 else 0 end as all_match_fk_indexes_exist
from pg_indexes where schemaname='public' and tablename='ff_matches'
  and indexname in ('ff_matches_season_id_idx','ff_matches_home_id_idx','ff_matches_away_id_idx');
select 1 / case when count(*)=3 then 1 else 0 end as indexed_fk_columns_match
from pg_index idx
join pg_class tbl on tbl.oid=idx.indrelid
join pg_namespace ns on ns.oid=tbl.relnamespace
join pg_class ind on ind.oid=idx.indexrelid
join pg_attribute att on att.attrelid=tbl.oid
  and att.attnum=idx.indkey[0]
where ns.nspname='public' and tbl.relname='ff_matches'
  and (ind.relname='ff_matches_season_id_idx' and att.attname='season_id'
    or ind.relname='ff_matches_home_id_idx' and att.attname='home_id'
    or ind.relname='ff_matches_away_id_idx' and att.attname='away_id');
