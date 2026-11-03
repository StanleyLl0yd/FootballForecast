-- M2 private model escrow: disposable PG17 synthetic-only security tests.
\echo 'M2 immutable private model escrow gate'
select 1 / case when (
  select c.relrowsecurity and c.relforcerowsecurity from pg_class c
  where c.oid='ff_private.ff_m2_training_model_escrow'::regclass
) and not has_table_privilege('anon','ff_private.ff_m2_training_model_escrow','SELECT')
  and not has_table_privilege('authenticated','ff_private.ff_m2_training_model_escrow','SELECT')
  and not has_table_privilege('service_role','ff_private.ff_m2_training_model_escrow','SELECT')
  and not has_table_privilege('anon','ff_private.ff_m2_training_model_escrow','INSERT')
  and not has_table_privilege('authenticated','ff_private.ff_m2_training_model_escrow','INSERT')
  and not has_table_privilege('service_role','ff_private.ff_m2_training_model_escrow','INSERT')
  and not has_table_privilege('service_role','ff_private.ff_m2_training_model_escrow','UPDATE')
then 1 else 0 end as no_browser_or_service_access;

begin;
do $m2_escrow_test$
declare
  v_private bytea := convert_to('{"test":"synthetic"}' || chr(10),'UTF8');
  v_sha text;
  v_id uuid;
  v_stored text;
begin
  v_sha := encode(sha256(v_private),'hex');
  insert into ff_private.ff_m2_training_model_escrow (
    protocol,source_commit,source_blob_sha1,source_sha256,code_sha,
    train_rows_sha256,club_mapping_sha256,fitted_model_sha256,
    model_artifact_sha256,model_bytes,training_matches,training_clubs,github_run_id
  ) values (
    'm2-openfootball-calendar-v1',
    '63df627f3c87ce71708f016522ea236cf74332c3',
    '6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc',
    repeat('a',64),repeat('b',40),repeat('c',64),repeat('d',64),
    repeat('e',64),v_sha,v_private,240,16,123456789
  ) returning id into v_id;
  select encode(sha256(model_bytes),'hex') into strict v_stored
  from ff_private.ff_m2_training_model_escrow where id=v_id;
  if v_sha<>v_stored then raise exception 'M2 private escrow digest mismatch'; end if;

  -- Digest/bytes cannot be forged.
  begin
    insert into ff_private.ff_m2_training_model_escrow (
      protocol,source_commit,source_blob_sha1,source_sha256,code_sha,
      train_rows_sha256,club_mapping_sha256,fitted_model_sha256,
      model_artifact_sha256,model_bytes,training_matches,training_clubs,github_run_id
    ) select protocol,source_commit,source_blob_sha1,
      repeat('1',64),code_sha,train_rows_sha256,club_mapping_sha256,
      fitted_model_sha256,repeat('0',64),model_bytes,240,16,123456790
    from ff_private.ff_m2_training_model_escrow where id=v_id;
    raise exception 'M2 accepted model digest substitution';
  exception when check_violation then null;
  end;
  -- Not a backdoor to mark private models approved or peek at holdout.
  begin
    insert into ff_private.ff_m2_training_model_escrow (
      protocol,source_commit,source_blob_sha1,source_sha256,code_sha,
      train_rows_sha256,club_mapping_sha256,fitted_model_sha256,
      model_artifact_sha256,model_bytes,training_matches,training_clubs,
      github_run_id,holdout_read
    ) select protocol,source_commit,source_blob_sha1,
      repeat('1',64),code_sha,train_rows_sha256,club_mapping_sha256,
      fitted_model_sha256,model_artifact_sha256,model_bytes,240,16,
      123456790,true
    from ff_private.ff_m2_training_model_escrow where id=v_id;
    raise exception 'M2 accepted held-out access marker';
  exception when check_violation then null;
  end;
  begin
    update ff_private.ff_m2_training_model_escrow
      set fitted_model_sha256=repeat('f',64) where id=v_id;
    raise exception 'M2 allowed update to immutable model';
  exception when others then
    if SQLERRM<>'Source snapshot history is append-only' then raise; end if;
  end;
  begin
    delete from ff_private.ff_m2_training_model_escrow where id=v_id;
    raise exception 'M2 allowed delete of immutable model';
  exception when others then
    if SQLERRM<>'Source snapshot history is append-only' then raise; end if;
  end;
  begin
    truncate ff_private.ff_m2_training_model_escrow;
    raise exception 'M2 allowed truncate of immutable models';
  exception when others then
    if SQLERRM<>'Source snapshot history is append-only' then raise; end if;
  end;
  if (select count(*) from ff_private.ff_m2_training_model_escrow)<>1 then
    raise exception 'M2 synthetic append-only model disappeared';
  end if;
end;
$m2_escrow_test$;
rollback;
select 1 / case when not exists(
  select 1 from ff_private.ff_m2_training_model_escrow
) then 1 else 0 end as synthetic_rollback_verified;
\echo 'PASS: M2 private immutable model escrow'
