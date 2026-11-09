-- Synthetic-only PG17 proof: first M2 fixed evaluation is irreversible.
\echo 'M2 single-use protected private study and score tables'
select 1 / case when
  (select c.relrowsecurity and c.relforcerowsecurity from pg_class c
   where c.oid = 'ff_private.ff_m2_one_use_study_claims'::regclass)
  and
  (select c.relrowsecurity and c.relforcerowsecurity from pg_class c
   where c.oid = 'ff_private.ff_m2_one_use_study_results'::regclass)
  and not has_table_privilege('anon','ff_private.ff_m2_one_use_study_claims','SELECT')
  and not has_table_privilege('authenticated','ff_private.ff_m2_one_use_study_claims','SELECT')
  and not has_table_privilege('service_role','ff_private.ff_m2_one_use_study_claims','SELECT')
  and not has_table_privilege('anon','ff_private.ff_m2_one_use_study_claims','INSERT')
  and not has_table_privilege('authenticated','ff_private.ff_m2_one_use_study_claims','INSERT')
  and not has_table_privilege('service_role','ff_private.ff_m2_one_use_study_claims','INSERT')
  and not has_table_privilege('anon','ff_private.ff_m2_one_use_study_results','SELECT')
  and not has_table_privilege('authenticated','ff_private.ff_m2_one_use_study_results','SELECT')
  and not has_table_privilege('service_role','ff_private.ff_m2_one_use_study_results','SELECT')
  and not has_table_privilege('anon','ff_private.ff_m2_one_use_study_results','INSERT')
  and not has_table_privilege('authenticated','ff_private.ff_m2_one_use_study_results','INSERT')
  and not has_table_privilege('service_role','ff_private.ff_m2_one_use_study_results','INSERT')
then 1 else 0 end as private_roles_fail_closed;

begin;
insert into ff_private.ff_m2_one_use_study_claims (
  study_id,study_declaration_sha256,code_sha,github_run_id,
  predeclared_names_sha256,source_uri,model_artifact_sha256,fitted_model_sha256,
  research_classification,source_scope,
  committed_before_first_label_read,prediction_publication_permitted
) values (
  'rpl-2025-26-football-data-fixed-poisson-v1',
  repeat('a',64),repeat('b',40),123456789,repeat('f',64),
  'https://www.football-data.co.uk/new/RUS.csv',
  '5d1893ac2d3e632f979b1ec67ed751edfa38733b9faf6371fc3f5e24b97fa28d',
  '987caad53cf77e4977482b4e9750b2c779912b47d0bc884cfb3807e8151ad95d',
  'NON_STRICT_RETROSPECTIVE','OWNER_PERSONAL_RESEARCH',true,false
);
insert into ff_private.ff_m2_one_use_study_results (
  study_id,github_run_id,source_sha256,selected_rows_sha256,
  predeclared_names_sha256,total_fixtures,eligible_fixtures,abstentions,
  kickoff_time_quality,model_log_loss,model_brier,model_rps,
  prior_log_loss,prior_brier,prior_rps,model_top1_accuracy,prior_top1_accuracy,
  no_model_tuning,no_source_rows_published
) values (
  'rpl-2025-26-football-data-fixed-poisson-v1',123456789,repeat('c',64),
  repeat('d',64),repeat('f',64),240,182,58,'DAY_ONLY',
  1.05,0.67,0.42,1.08,0.68,0.43,0.44,0.40,true,true
);
do $m2_once$
declare
  fixed_study constant text := 'rpl-2025-26-football-data-fixed-poisson-v1';
begin
  if (select count(*) from ff_private.ff_m2_one_use_study_claims) <> 1
     or (select count(*) from ff_private.ff_m2_one_use_study_results) <> 1 then
    raise exception 'M2 one-use claim/result synthetic insertion failed';
  end if;
  begin
    insert into ff_private.ff_m2_one_use_study_claims (
      study_id,study_declaration_sha256,code_sha,github_run_id,
      predeclared_names_sha256,source_uri,
      model_artifact_sha256,fitted_model_sha256,research_classification,
      source_scope,committed_before_first_label_read,prediction_publication_permitted
    ) select study_id,study_declaration_sha256,code_sha,123456790,
             predeclared_names_sha256,source_uri,
             model_artifact_sha256,fitted_model_sha256,research_classification,
             source_scope,true,false
    from ff_private.ff_m2_one_use_study_claims where study_id=fixed_study;
    raise exception 'M2 allowed second one-use claim';
  exception when unique_violation then null;
  end;
  begin
    insert into ff_private.ff_m2_one_use_study_claims (
      study_id,study_declaration_sha256,code_sha,github_run_id,
      predeclared_names_sha256,source_uri,
      model_artifact_sha256,fitted_model_sha256,research_classification,
      source_scope,committed_before_first_label_read,prediction_publication_permitted
    ) select study_id,study_declaration_sha256,code_sha,123456790,
             predeclared_names_sha256,'https://unapproved.example/bad.csv',
             model_artifact_sha256,
             fitted_model_sha256,research_classification,
             source_scope,true,false
    from ff_private.ff_m2_one_use_study_claims where study_id=fixed_study;
    raise exception 'M2 accepted arbitrary label source URL';
  exception when check_violation then null;
  end;
  begin
    insert into ff_private.ff_m2_one_use_study_results (
      study_id,github_run_id,source_sha256,selected_rows_sha256,
      predeclared_names_sha256,total_fixtures,eligible_fixtures,abstentions,
      kickoff_time_quality,model_log_loss,model_brier,model_rps,
      prior_log_loss,prior_brier,prior_rps,model_top1_accuracy,prior_top1_accuracy,
      no_model_tuning,no_source_rows_published
    ) select study_id,123456790,source_sha256,selected_rows_sha256,
             predeclared_names_sha256,total_fixtures,eligible_fixtures,abstentions,
             kickoff_time_quality,model_log_loss,model_brier,model_rps,
             prior_log_loss,prior_brier,prior_rps,model_top1_accuracy,
             prior_top1_accuracy,true,true
    from ff_private.ff_m2_one_use_study_results where study_id=fixed_study;
    raise exception 'M2 allowed multiple result rows';
  exception when unique_violation then null;
  end;
  begin
    update ff_private.ff_m2_one_use_study_claims set code_sha=repeat('0',40);
    raise exception 'M2 allowed altering pre-read reservation';
  exception when others then
    if SQLERRM <> 'Source snapshot history is append-only' then raise; end if;
  end;
  begin
    delete from ff_private.ff_m2_one_use_study_claims;
    raise exception 'M2 allowed deleting pre-read reservation';
  exception when others then
    if SQLERRM <> 'Source snapshot history is append-only' then raise; end if;
  end;
  begin
    update ff_private.ff_m2_one_use_study_results set model_log_loss=0;
    raise exception 'M2 allowed changing evaluation results';
  exception when others then
    if SQLERRM <> 'Source snapshot history is append-only' then raise; end if;
  end;
  begin
    truncate ff_private.ff_m2_one_use_study_results;
    raise exception 'M2 allowed truncating evaluation results';
  exception when others then
    if SQLERRM <> 'Source snapshot history is append-only' then raise; end if;
  end;
end;
$m2_once$;
rollback;
select 1 / case when
  (select count(*) from ff_private.ff_m2_one_use_study_claims) = 0 and
  (select count(*) from ff_private.ff_m2_one_use_study_results) = 0
then 1 else 0 end as synthetic_rollback_verified;
\echo 'PASS: private M2 one-use reservation and append-only aggregate scores'
