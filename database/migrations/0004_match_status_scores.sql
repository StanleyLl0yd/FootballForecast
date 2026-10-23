-- M0: scores are only valid for finished, awarded or live matches.
-- A scheduled, postponed or cancelled fixture never has a final score.
-- Preserve live matches with both unknown (NULL) or both provisional goals.
-- Adding a validated CHECK fails closed if pre-existing real rows violate it:
-- do not silently rewrite or discard original source records.
ALTER TABLE public.ff_matches
  ADD CONSTRAINT ff_matches_status_scores_consistent CHECK (
    (status IN ('finished','awarded') AND
      home_goals IS NOT NULL AND away_goals IS NOT NULL)
    OR
    (status IN ('scheduled','postponed','cancelled') AND
      home_goals IS NULL AND away_goals IS NULL)
    OR
    (status = 'live' AND
      ((home_goals IS NULL AND away_goals IS NULL) OR
       (home_goals IS NOT NULL AND away_goals IS NOT NULL)))
  );
