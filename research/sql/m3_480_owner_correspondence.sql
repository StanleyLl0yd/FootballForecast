-- M3-A3: complete 2021/22 and 2022/23 match-graph correspondence.
-- Exactly one bound parameter: JSON array of 480 PUBLIC source fixtures.
-- Private source identifiers, scores and per-fixture records remain INSIDE
-- PostgreSQL. Result contains ONLY two season-level aggregate rows.
-- Read-only, no 2025/26, no M2 escrow, no public predictions.
WITH public_games AS (
 SELECT x.season, x.match_date, x.home_alias, x.away_alias,
        x.hg, x.ag, x.revised
 FROM jsonb_to_recordset(%s::jsonb) AS x(
   season text,match_date date,home_alias text,away_alias text,
   hg integer,ag integer,revised boolean)
), private_games AS (
 SELECT s.season,(m.kickoff_at AT TIME ZONE 'UTC')::date AS match_date,
        m.home_team_id AS home_id,m.away_team_id AS away_id,
        m.home_goals::integer hg,m.away_goals::integer ag,m.status
 FROM ff_private.ff_rpl_history_snapshots s
 JOIN ff_private.ff_rpl_history_matches m ON m.snapshot_id=s.id
 WHERE s.season IN ('2021/22','2022/23')
), public_counts AS (
 SELECT season,count(*)::integer n,count(DISTINCT home_alias) home_clubs,
        count(DISTINCT away_alias) away_clubs,
        count(DISTINCT (home_alias,away_alias)) pairs,
        sum(hg) home_goals,sum(ag) away_goals,
        count(*) FILTER (WHERE home_alias IS NULL OR away_alias IS NULL OR
          match_date IS NULL OR hg IS NULL OR ag IS NULL OR revised IS NULL OR
          home_alias=away_alias OR hg<0 OR hg>20 OR ag<0 OR ag>20
        ) bad
 FROM public_games GROUP BY season
), private_counts AS (
 SELECT season,count(*)::integer n,count(DISTINCT home_id) home_clubs,
        count(DISTINCT away_id) away_clubs,
        count(DISTINCT (home_id,away_id)) pairs,
        count(*) FILTER (WHERE home_id IS NULL OR away_id IS NULL OR
          match_date IS NULL OR hg IS NULL OR ag IS NULL OR
          status IS DISTINCT FROM 'finished' OR
          home_id=away_id OR hg<0 OR hg>20 OR ag<0 OR ag>20
        ) bad
 FROM private_games GROUP BY season
), public_roles AS (
 SELECT season,home_alias alias,match_date,'H' role FROM public_games
 UNION ALL
 SELECT season,away_alias alias,match_date,'A' role FROM public_games
), private_roles AS (
 SELECT season,home_id private_id,match_date,'H' role FROM private_games
 UNION ALL
 SELECT season,away_id private_id,match_date,'A' role FROM private_games
), public_signatures AS (
 SELECT season,alias,ARRAY_AGG(match_date::text||role ORDER BY match_date,role) signature,
        count(*)::integer n,count(*) FILTER (WHERE role='H')::integer home_n
 FROM public_roles GROUP BY season,alias
), private_signatures AS (
 SELECT season,private_id,
        ARRAY_AGG(match_date::text||role ORDER BY match_date,role) signature,
        count(*)::integer n,count(*) FILTER (WHERE role='H')::integer home_n
 FROM private_roles GROUP BY season,private_id
), candidates AS (
 SELECT p.season,p.alias,q.private_id FROM public_signatures p
 JOIN private_signatures q
 ON q.season=p.season AND q.signature=p.signature
 WHERE p.n=30 AND p.home_n=15 AND q.n=30 AND q.home_n=15
), public_degrees AS (
 SELECT season,alias,count(*)::integer n FROM candidates GROUP BY season,alias
), private_degrees AS (
 SELECT season,private_id,count(*)::integer n
 FROM candidates GROUP BY season,private_id
), links AS (
 SELECT c.* FROM candidates c
 JOIN public_degrees pd ON pd.season=c.season AND pd.alias=c.alias AND pd.n=1
 JOIN private_degrees vd ON vd.season=c.season
   AND vd.private_id=c.private_id AND vd.n=1
), fixture_edges AS (
 SELECT p.season,p.revised,p.hg AS public_hg,p.ag AS public_ag,
        m.hg AS private_hg,m.ag AS private_ag
 FROM public_games p
 JOIN links h ON h.season=p.season AND h.alias=p.home_alias
 JOIN links a ON a.season=p.season AND a.alias=p.away_alias
 JOIN private_games m
 ON m.season=p.season AND m.match_date=p.match_date
   AND m.home_id=h.private_id AND m.away_id=a.private_id
), season_summary AS (
 SELECT e.season,
       (SELECT count(*)::integer FROM links l WHERE l.season=e.season) mapped_clubs,
       count(*)::integer matched_fixtures,
       count(*) FILTER (WHERE public_hg=private_hg AND public_ag=private_ag)::integer
          official_score_agreements,
       count(*) FILTER (WHERE public_hg IS DISTINCT FROM private_hg
          OR public_ag IS DISTINCT FROM private_ag)::integer official_score_disagreements,
       count(*) FILTER (WHERE revised AND public_hg=private_hg
          AND public_ag=private_ag)::integer revised_official_excluded,
       count(*) FILTER (WHERE NOT revised AND public_hg=private_hg
          AND public_ag=private_ag)::integer candidate_played_score_agreements
 FROM fixture_edges e GROUP BY e.season
), normalized_links AS (
 SELECT season,CASE alias
    WHEN 'Ahmat' THEN 'Akhmat'
    WHEN 'NNovgorod' THEN 'Pari NN'
    ELSE alias END AS canonical, private_id
 FROM links
), common AS (
 SELECT count(*)::integer shared_clubs,
        count(*) FILTER (WHERE a.private_id=b.private_id)::integer stable_clubs
 FROM normalized_links a JOIN normalized_links b
 ON a.canonical=b.canonical
 WHERE a.season='2021/22' AND b.season='2022/23'
), valid AS (
 SELECT
 (SELECT count(*)=480 AND count(DISTINCT season)=2 AND
  count(*) FILTER (WHERE season NOT IN ('2021/22','2022/23')
    OR (season='2021/22' AND
       (match_date<'2021-07-01' OR match_date>='2022-07-01'))
    OR (season='2022/23' AND
       (match_date<'2022-07-01' OR match_date>='2023-07-01'))) = 0
  FROM public_games)
 AND (SELECT count(*)=480 AND count(DISTINCT season)=2 FROM private_games)
 AND (SELECT count(*)=2 AND bool_and(
       n=240 AND home_clubs=16 AND away_clubs=16 AND pairs=240 AND bad=0
       AND ((season='2021/22' AND home_goals=359 AND away_goals=280)
          OR (season='2022/23' AND home_goals=411 AND away_goals=319)))
       FROM public_counts)
 AND (SELECT count(*)=2 AND bool_and(
       n=240 AND home_clubs=16 AND away_clubs=16 AND pairs=240 AND bad=0)
       FROM private_counts)
 AND (SELECT count(*)=32 AND bool_and(n=30 AND home_n=15)
       FROM public_signatures)
 AND (SELECT count(*)=32 AND bool_and(n=30 AND home_n=15)
       FROM private_signatures)
 AS ok
)
SELECT s.season,s.mapped_clubs,s.matched_fixtures,
       s.official_score_agreements,s.official_score_disagreements,
       s.revised_official_excluded,s.candidate_played_score_agreements,
       c.shared_clubs,c.stable_clubs
FROM season_summary s CROSS JOIN common c CROSS JOIN valid v
WHERE v.ok ORDER BY s.season;
