-- M1: preserve new raw source bytes as immutable evidence without copying identical normalized fixtures.
create table if not exists ff_private.ff_source_byte_observations (
  source_id uuid not null references public.ff_sources(id),
  source_sha256 text not null check (
    length(source_sha256)=64 and source_sha256 !~ '[^a-f0-9]'),
  semantic_sha256 text not null check (
    length(semantic_sha256)=64 and semantic_sha256 !~ '[^a-f0-9]'),
  snapshot_id uuid not null references ff_private.ff_ingest_snapshots(id),
  retrieved_at timestamptz not null,
  primary key(source_id,source_sha256)
);
create index if not exists ff_source_byte_observations_snapshot_idx
  on ff_private.ff_source_byte_observations(snapshot_id);
alter table ff_private.ff_source_byte_observations enable row level security;
revoke all on ff_private.ff_source_byte_observations from public,anon,authenticated;
create trigger ff_source_byte_observations_immutable
  before update or delete on ff_private.ff_source_byte_observations
  for each row execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_source_byte_observations_no_truncate
  before truncate on ff_private.ff_source_byte_observations
  for each statement execute function ff_private.ff_reject_ingest_mutation();

-- One approved source SHA resolves either a full snapshot or a compact observation.
-- The only caller is the protected private importer; no anonymous execution.
create function ff_private.ff_resolve_footbolno_source_sha(p_hash text)
returns uuid
language plpgsql stable security invoker set search_path=''
as $m1_resolve$
declare
  v_source uuid;
  v_snapshot uuid;
begin
  if p_hash is null or length(p_hash)<>64 or p_hash ~ '[^a-f0-9]' then
    raise exception 'M1 observation: invalid source hash';
  end if;
  select src.id into strict v_source
  from public.ff_sources src
  where src.name='Footbolno' and src.license_status='approved'
    and src.license_reference='https://footbolno.ru/otkrytye-dannye';
  select s.id into v_snapshot
  from ff_private.ff_ingest_snapshots s
  where s.source_id=v_source and s.source_sha256=p_hash
    and s.source_url='https://footbolno.ru/data/league/235-matches.csv'
    and s.license_url='https://footbolno.ru/otkrytye-dannye';
  if v_snapshot is null then
    select o.snapshot_id into v_snapshot
    from ff_private.ff_source_byte_observations o
    join ff_private.ff_ingest_snapshots s on s.id=o.snapshot_id
    where o.source_id=v_source and o.source_sha256=p_hash
      and s.source_id=v_source
      and s.source_url='https://footbolno.ru/data/league/235-matches.csv'
      and s.license_url='https://footbolno.ru/otkrytye-dannye';
  end if;
  if v_snapshot is null then
    raise exception 'M1 observation: approved source snapshot not found';
  end if;
  return v_snapshot;
end;
$m1_resolve$;
revoke all on function ff_private.ff_resolve_footbolno_source_sha(text)
  from public,anon,authenticated;
