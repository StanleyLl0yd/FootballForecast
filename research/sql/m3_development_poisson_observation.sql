-- M3 SELECT-only exploratory seven-season Poisson; never touch 2025/26.
-- PRELIMINARY NON_STRICT_RETROSPECTIVE: provider-finished labels, not certified
-- independently on-field. 7 known administrative candidates quarantined.
-- Five expanding folds, frozen shrinkage from m3_synthetic_team_poisson.py.
WITH seasons(season,season_order) AS (
 VALUES ('2018/19',0),('2019/20',1),('2020/21',2),('2021/22',3),
 ('2022/23',4),('2023/24',5),('2024/25',6)
), exclusions(season,day,hg,ag,reason) AS (
 VALUES
 ('2019/20','2020-06-27'::date,0,3,'technical'),
 ('2019/20','2020-07-01'::date,0,3,'technical'),
 ('2019/20','2020-07-16'::date,3,0,'technical'),
 ('2019/20','2020-07-22'::date,3,0,'technical'),
 ('2020/21','2020-09-13'::date,0,3,'technical'),
 ('2020/21','2020-09-19'::date,3,0,'technical'),
 ('2022/23','2023-03-19'::date,0,3,'revised_official')
), raw AS (
 SELECT y.season,y.season_order,m.source_match_id,m.home_team_id,
 m.away_team_id,m.kickoff_at,m.home_goals::int hg,m.away_goals::int ag,m.status
 FROM seasons y JOIN ff_private.ff_rpl_history_snapshots s ON s.season=y.season
 JOIN ff_private.ff_rpl_history_matches m ON m.snapshot_id=s.id
), tagged AS (
 SELECT r.*,e.reason FROM raw r LEFT JOIN exclusions e
 ON r.season=e.season AND (r.kickoff_at AT TIME ZONE 'UTC')::date=e.day
 AND r.hg=e.hg AND r.ag=e.ag
), season_check AS (
 SELECT season,count(*) n,count(DISTINCT home_team_id) h,
 count(DISTINCT away_team_id) a,
 count(DISTINCT (home_team_id,away_team_id)) pairs,
 count(*) FILTER (WHERE status IS DISTINCT FROM 'finished' OR kickoff_at IS NULL
 OR source_match_id IS NULL OR home_team_id IS NULL OR away_team_id IS NULL
 OR hg IS NULL OR ag IS NULL OR hg<0 OR ag<0 OR hg>20 OR ag>20) invalid FROM raw GROUP BY season
), gate AS (
 SELECT count(*)=7 AND min(n)=240 AND max(n)=240
 AND min(h)=16 AND max(h)=16 AND min(a)=16 AND max(a)=16
 AND min(pairs)=240 AND max(pairs)=240 AND sum(invalid)=0
 AND (SELECT count(*)=7 FROM tagged WHERE reason IS NOT NULL)
 AND (SELECT count(DISTINCT (season,(kickoff_at AT TIME ZONE 'UTC')::date,hg,ag))=7
      FROM tagged WHERE reason IS NOT NULL) AS ok FROM season_check
), eligible AS (
 SELECT *,CASE WHEN hg>ag THEN 0 WHEN hg=ag THEN 1 ELSE 2 END label
 FROM tagged WHERE reason IS NULL
), fold AS (
 SELECT season,season_order FROM seasons WHERE season_order>=2
), training AS (
 SELECT f.season_order fold,e.* FROM fold f
 JOIN eligible e ON e.season_order<f.season_order
), totals AS (
 SELECT fold,count(*) n,sum(hg)::float8 home_goals,
 sum(ag)::float8 away_goals FROM training GROUP BY fold
), league AS (
 SELECT fold,n,(home_goals+20*1.35)/(n+20) mu_h,
 (away_goals+20*1.05)/(n+20) mu_a FROM totals
), home AS (
 SELECT fold,home_team_id team,count(*) n,
 sum(hg)::float8 scored,sum(ag)::float8 conceded
 FROM training GROUP BY fold,home_team_id
), away AS (
 SELECT fold,away_team_id team,count(*) n,
 sum(ag)::float8 scored,sum(hg)::float8 conceded
 FROM training GROUP BY fold,away_team_id
), rates AS (
 SELECT f.season validation_season,l.n train_n,e.source_match_id,e.label,
 (h.team IS NULL OR a.team IS NULL) unseen,
 least(6.0,greatest(0.05,
 ((coalesce(h.scored,0)+12*l.mu_h)/(coalesce(h.n,0)+12)) *
 ((coalesce(a.conceded,0)+12*l.mu_h)/(coalesce(a.n,0)+12)) / l.mu_h)) lambda_h,
 least(6.0,greatest(0.05,
 ((coalesce(a.scored,0)+12*l.mu_a)/(coalesce(a.n,0)+12)) *
 ((coalesce(h.conceded,0)+12*l.mu_a)/(coalesce(h.n,0)+12)) / l.mu_a)) lambda_a
 FROM fold f JOIN eligible e ON e.season_order=f.season_order
 JOIN league l ON l.fold=f.season_order
 LEFT JOIN home h ON h.fold=f.season_order AND h.team=e.home_team_id
 LEFT JOIN away a ON a.fold=f.season_order AND a.team=e.away_team_id
), pmf AS (
 SELECT r.validation_season,r.train_n,r.source_match_id,r.label,r.unseen,
 gh.g AS home_goals, ga.g AS away_goals,
 exp(-r.lambda_h-r.lambda_a)
 * power(r.lambda_h,gh.g) * power(r.lambda_a,ga.g)
 / factorial(gh.g::bigint) / factorial(ga.g::bigint) AS mass
 FROM rates r CROSS JOIN generate_series(0,30) gh(g)
 CROSS JOIN generate_series(0,30) ga(g)
), outcome AS (
 SELECT validation_season,train_n,source_match_id,label,unseen,
 sum(mass) FILTER(WHERE home_goals>away_goals) AS wh,
 sum(mass) FILTER(WHERE home_goals=away_goals) AS wd,
 sum(mass) FILTER(WHERE home_goals<away_goals) AS wa,
 sum(mass) AS total
 FROM pmf GROUP BY validation_season,train_n,source_match_id,label,unseen
), p AS (
 SELECT *,wh/total ph,wd/total pd,wa/total pa FROM outcome
), baseline AS (
 SELECT f.season AS validation_season,
 (count(*) FILTER(WHERE t.label=0)+1)::float8/(count(*)+3) bh,
 (count(*) FILTER(WHERE t.label=1)+1)::float8/(count(*)+3) bd,
 (count(*) FILTER(WHERE t.label=2)+1)::float8/(count(*)+3) ba
 FROM fold f JOIN training t ON t.fold=f.season_order
 GROUP BY f.season
), metrics AS (
 SELECT p.validation_season,p.train_n,p.unseen,
 -ln(CASE label WHEN 0 THEN ph WHEN 1 THEN pd ELSE pa END) ll,
 power(ph-(label=0)::int,2) + power(pd-(label=1)::int,2)
   + power(pa-(label=2)::int,2) brier,
 power(ph-(label=0)::int,2) + power(ph+pd-(label<2)::int,2) rps,
 -ln(CASE label WHEN 0 THEN bh WHEN 1 THEN bd ELSE ba END) baseline_ll,
 power(bh-(label=0)::int,2)+power(bd-(label=1)::int,2)
   +power(ba-(label=2)::int,2) baseline_brier,
 power(bh-(label=0)::int,2)+power(bh+bd-(label<2)::int,2) baseline_rps
 FROM p JOIN baseline b ON b.validation_season=p.validation_season
)
SELECT validation_season,max(train_n)::int train_n,
 count(*)::int scored_n, (240-count(*))::int abstained_n,
 count(*) FILTER (WHERE unseen)::int unseen_n,
 round(avg(baseline_ll)::numeric,6) baseline_log_loss,
 round(avg(ll)::numeric,6) poisson_log_loss,
 round(avg(baseline_ll-ll)::numeric,6) paired_log_loss_gain,
 round((1.96*stddev_samp(baseline_ll-ll)/sqrt(count(*)))::numeric,6)
   AS paired_gain_approx_95pct_halfwidth,
 round(avg(baseline_brier)::numeric,6) baseline_brier,
 round(avg(brier)::numeric,6) poisson_brier,
 round(avg(baseline_rps)::numeric,6) baseline_rps,
 round(avg(rps)::numeric,6) poisson_rps
FROM metrics WHERE (SELECT ok FROM gate)
GROUP BY validation_season ORDER BY validation_season;
