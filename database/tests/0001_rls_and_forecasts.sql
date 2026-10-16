-- Exact behaviour checks against an ephemeral PostgreSQL service.
-- Caller supplies a freshly created database; no production credentials or data.
\echo 'Verifying migration, RLS, archive immutability and temporal cutoffs'

create function pg_temp.expect_rejection(statement text, expected_state text, expected_message text)
returns void language plpgsql as $$
declare observed_state text;
declare observed_message text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics observed_state = returned_sqlstate, observed_message = message_text;
    if observed_state <> expected_state
       or position(expected_message in observed_message) = 0 then
      raise exception 'Unexpected error: % / %; wanted: % / %',
        observed_state, observed_message, expected_state, expected_message;
    end if;
    return;
  end;
  raise exception 'Unexpected success: %', statement;
end;
$$;

-- Hard-coded identifiers are CI-only fixtures, not actual users, matches or predictions.
insert into auth.users (id) values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');
insert into public.ff_access_grants(user_id,provider_id,role) values
 ('00000000-0000-0000-0000-000000000001', 'github-test-owner', 'administrator');
insert into public.ff_competitions(id,code,name) values
 ('10000000-0000-0000-0000-000000000001', 'FAKE', 'Temporary CI league');
insert into public.ff_seasons(id,competition_id,name) values
 ('11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','2099');
insert into public.ff_teams(id,name,normalized_name) values
 ('12000000-0000-0000-0000-000000000001','Synthetic home','synthetic-home'),
 ('12000000-0000-0000-0000-000000000002','Synthetic away','synthetic-away');
insert into public.ff_matches(id,season_id,home_id,away_id,kickoff_at) values
 ('13000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000002',clock_timestamp()+interval '1 day');

-- Give browser roles permissive *table grants* to demonstrate RLS is effective.
-- The application migration itself must not grant writes to those roles.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

\echo 'RLS: anonymous and unprovisioned users cannot read, write or grant themselves access'
set role anon;
select 1 / case when (select count(*) from public.ff_matches) = 0 then 1 else 0 end as anon_no_read;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select 1 / case when (select count(*) from public.ff_matches) = 0 then 1 else 0 end as unprovisioned_no_read;
select 1 / case when (select count(*) from public.ff_access_grants) = 0 then 1 else 0 end as cannot_read_other_grants;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select 1 / case when (select count(*) from public.ff_matches) = 1 then 1 else 0 end as owner_can_read;
select 1 / case when (select count(*) from public.ff_access_grants) = 1 then 1 else 0 end as owner_can_read_own_grant;
reset role;

-- Reject a forged role grant and a direct data change from an authorized account.
-- SET ROLE changes the current permission context; each role is reset afterward.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.expect_rejection(
 $sql$insert into public.ff_access_grants(user_id,provider_id,role)
 values ('00000000-0000-0000-0000-000000000002','forged','administrator')$sql$,
 '42501','row-level security');
-- PostgreSQL RLS silently filters unauthorized DELETE/UPDATE; assert no rows changed.
delete from public.ff_matches where id='13000000-0000-0000-0000-000000000001';
reset role;
select 1 / case when (select count(*) from public.ff_matches) = 1 then 1 else 0 end as cannot_delete_fixture;

\echo 'Live forecast guard: only a real-time pre-kickoff publication is accepted'
select pg_temp.expect_rejection($sql$
  insert into public.ff_forecasts
  (match_id,revision,predicted_at,as_of_at,model_version,dataset_sha256,model_sha256,
   prediction_sha256,commit_sha,home_win,draw,away_win,expected_home,expected_away,score_distribution)
  values ('13000000-0000-0000-0000-000000000001',1,
  clock_timestamp()-interval '1 hour',clock_timestamp()-interval '2 hours','test',
  repeat('a',64),repeat('b',64),repeat('c',64),repeat('d',40),.4,.3,.3,1.2,.8,'{}')
$sql$, 'P0001','publication time');

select pg_temp.expect_rejection($sql$
  insert into public.ff_forecasts
  (match_id,revision,predicted_at,as_of_at,model_version,dataset_sha256,model_sha256,
   prediction_sha256,commit_sha,home_win,draw,away_win,expected_home,expected_away,score_distribution)
  values ('13000000-0000-0000-0000-000000000001',1,
  clock_timestamp()+interval '2 days',clock_timestamp(),'test',
  repeat('a',64),repeat('b',64),repeat('c',64),repeat('d',40),.4,.3,.3,1.2,.8,'{}')
$sql$, 'P0001','before match kickoff');

-- A simulated pre-kickoff forecast in this ephemeral test database only.
insert into public.ff_forecasts
 (id,match_id,revision,predicted_at,as_of_at,model_version,dataset_sha256,model_sha256,
  prediction_sha256,commit_sha,home_win,draw,away_win,expected_home,expected_away,score_distribution)
values ('14000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001',
 1,clock_timestamp(),clock_timestamp()-interval '1 minute','synthetic',
 repeat('a',64),repeat('b',64),repeat('c',64),repeat('d',40),
 .4,.3,.3,1.2,.8,'{}');
select 1 / case when (select count(*) from public.ff_forecasts)=1 then 1 else 0 end as inserted_live_stub;

\echo 'Archive append-only guard: updates and deletes rejected even by database owner'
select pg_temp.expect_rejection(
 $sql$update public.ff_forecasts set model_version='tampered' where id='14000000-0000-0000-0000-000000000001'$sql$,
 'P0001','Append-only');
select pg_temp.expect_rejection(
 $sql$delete from public.ff_forecasts where id='14000000-0000-0000-0000-000000000001'$sql$,
 'P0001','Append-only');
select pg_temp.expect_rejection(
 $sql$insert into public.ff_forecast_outcomes(forecast_id,result_home,result_away,log_loss,brier,rps)
  values ('14000000-0000-0000-0000-000000000001',1,0,.5,.4,.2)$sql$,
 'P0001','matching finished fixture');

-- Even a forged 'finished' status must not allow scoring before actual kickoff.
update public.ff_matches set status='finished',home_goals=1,away_goals=0
 where id='13000000-0000-0000-0000-000000000001';
select pg_temp.expect_rejection(
 $sql$insert into public.ff_forecast_outcomes(forecast_id,result_home,result_away,log_loss,brier,rps)
  values ('14000000-0000-0000-0000-000000000001',1,0,.5,.4,.2)$sql$,
 'P0001','matching finished fixture');

-- Restore a *synthetic historical snapshot* in disposable CI only.
-- The database owner must temporarily disable the live-publication trigger for
-- fixture setup; application/worker paths may NEVER use this technique.
insert into public.ff_matches(id,season_id,home_id,away_id,kickoff_at,status,home_goals,away_goals) values
 ('13000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000002',
  clock_timestamp()-interval '1 day','finished',1,0);
alter table public.ff_forecasts disable trigger ff_forecast_preinsert;
insert into public.ff_forecasts
 (id,match_id,revision,predicted_at,as_of_at,model_version,dataset_sha256,model_sha256,
  prediction_sha256,commit_sha,home_win,draw,away_win,expected_home,expected_away,score_distribution)
values ('14000000-0000-0000-0000-000000000002','13000000-0000-0000-0000-000000000002',
 1,clock_timestamp()-interval '2 days',clock_timestamp()-interval '2 days 1 hour','historical-test-only',
 repeat('a',64),repeat('b',64),repeat('c',64),repeat('d',40),
 .4,.3,.3,1.2,.8,'{}');
alter table public.ff_forecasts enable trigger ff_forecast_preinsert;

-- Wrong score rejected even for a finished historical fixture.
select pg_temp.expect_rejection(
 $sql$insert into public.ff_forecast_outcomes(forecast_id,result_home,result_away,log_loss,brier,rps)
  values ('14000000-0000-0000-0000-000000000002',2,0,.5,.4,.2)$sql$,
 'P0001','matching finished fixture');
insert into public.ff_forecast_outcomes(forecast_id,result_home,result_away,log_loss,brier,rps)
 values ('14000000-0000-0000-0000-000000000002',1,0,.5,.4,.2);
select 1 / case when (select count(*) from public.ff_forecast_outcomes)=1 then 1 else 0 end as valid_historical_outcome;
select pg_temp.expect_rejection(
 $sql$update public.ff_forecast_outcomes set result_home=2
 where forecast_id='14000000-0000-0000-0000-000000000002'$sql$,
 'P0001','Append-only');
select pg_temp.expect_rejection(
 $sql$delete from public.ff_forecast_outcomes
 where forecast_id='14000000-0000-0000-0000-000000000002'$sql$,
 'P0001','Append-only');
\echo 'PostgreSQL M0 negative and positive assertions complete.'
