-- M0: real PostgreSQL 17 status/goal invariant on synthetic fixtures only.
-- This runs in the SAME psql session as 0001_rls_and_forecasts.sql, which
-- defines pg_temp.expect_rejection. No real records, no source import.
\echo 'Checking scheduled/cancelled/postponed score invariant'
select 1 / case when count(*)=1 then 1 else 0 end
  as validated_status_goal_constraint
from pg_constraint c
where c.conrelid='public.ff_matches'::regclass
  and c.conname='ff_matches_status_scores_consistent'
  and c.contype='c' and c.convalidated;

-- Use the synthetic season/teams created by the earlier CI fixture.
select pg_temp.expect_rejection($sql$
  insert into public.ff_matches
    (season_id,home_id,away_id,kickoff_at,status,home_goals,away_goals)
  values ('11000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000002',
    clock_timestamp()+interval '1 day','scheduled',0,0)
$sql$,'23514','ff_matches_status_scores_consistent');

select pg_temp.expect_rejection($sql$
  insert into public.ff_matches
    (season_id,home_id,away_id,kickoff_at,status,home_goals,away_goals)
  values ('11000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000002',
    clock_timestamp()+interval '1 day','postponed',2,1)
$sql$,'23514','ff_matches_status_scores_consistent');

select pg_temp.expect_rejection($sql$
  insert into public.ff_matches
    (season_id,home_id,away_id,kickoff_at,status,home_goals,away_goals)
  values ('11000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000002',
    clock_timestamp()+interval '1 day','cancelled',1,1)
$sql$,'23514','ff_matches_status_scores_consistent');

-- All allowed states remain usable. The transaction is rolled back so the
-- synthetic restore test still receives exactly two fixture rows.
begin;
insert into public.ff_matches
  (season_id,home_id,away_id,kickoff_at,status,home_goals,away_goals)
select '11000000-0000-0000-0000-000000000001'::uuid,
       '12000000-0000-0000-0000-000000000001'::uuid,
       '12000000-0000-0000-0000-000000000002'::uuid,
       clock_timestamp()+interval '1 day',s.status,s.home_goals,s.away_goals
from (values
 ('scheduled',null::integer,null::integer),
 ('postponed',null::integer,null::integer),
 ('cancelled',null::integer,null::integer),
 ('live',null::integer,null::integer),
 ('live',1,0),
 ('finished',1,0),
 ('awarded',3,0)
) as s(status,home_goals,away_goals);
select 1 / case when (select count(*) from public.ff_matches)=9
then 1 else 0 end as seven_valid_temp_matches;
rollback;

select 1 / case when (select count(*) from public.ff_matches)=2
then 1 else 0 end as synthetic_fixture_count_preserved;
\echo 'PASS: not-played scores fail, live/completed semantics pass'
