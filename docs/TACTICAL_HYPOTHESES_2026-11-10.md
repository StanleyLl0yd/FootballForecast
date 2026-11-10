# Tactical hypothesis research registry · 2026-11-10

Tracking: [#284](https://github.com/StanleyLl0yd/FootballForecast/issues/284) (non-gating tactical research); [M3 #271](https://github.com/StanleyLl0yd/FootballForecast/issues/271) (current A3 source-eligibility gate); [ROADMAP](../ROADMAP.md). Machine-readable source: [registry JSON](TACTICAL_HYPOTHESIS_REGISTRY_2026-11-10.json).

## Evidence classification and scope

This is a **transfer of research context, not a training dataset**. The 2026-11-10 owner brief summarizes selected prior readings of [СБГ Аналитика](https://t.me/s/sbganalitica) across several seasons, including 2026/27; **the whole channel has not been audited**. The individual original 2026 example-post permalinks, full post text, original publication UTC timestamps and broadcast-derived sequence labels are **not independently verified**. Do not attribute precise video events to a source that was not checked. A separately visible channel post [example](https://t.me/s/sbganalitica/3996) discusses roles and positional choices, but does **not** validate the specific 2026-11-08 substitution interpretation in the supplied brief.

Independently confirmed *match results only*: [Zenit–Rostov, 2026-11-08, 2:2](https://www.championat.com/football/_russiapl/tournament/7096/match/1318698/); [Krylya Sovetov–Zenit, 2026-11-02, 0:3](https://www.championat.com/football/_russiapl/tournament/7096/match/1318660/). Match score does not establish a tactical explanation. In every hypothesis below, **observation** is either an independently grounded match-level result or explicitly **unverified**; the detailed mechanism is an **author-supplied hypothesis**, not a fact and not a causal finding.

The examples are from **2026/27**, which is **excluded** from frozen M3 development years 2018/19–2024/25. They may motivate prospective research only, not select parameters or validate folds.

## Existing implementation and source-feasibility boundary

- `ml/src/football_forecast/research/rpl_temporal_features.py` already computes **development-only, season-scoped** prior-day team goals/results counts, recent form and days since prior match, with explicit played-score, identity, UTC and season-window fail-closed gates. `m3_development_baseline.py` and `m3_synthetic_team_poisson.py` are synthetic-only five-fold candidates.
- Seven immutable private historical snapshots contain **1,680 provider-finished rows**, but M3-A3 has **not certified** their club continuity, played scores, original match/publication UTC, source rights or full eligibility; do not use as 1,680 training examples.
- The previous 350-row private *first-page sample* found **no populated sampled** venue, lineup, player, coach, shot, xG or odds candidate fields. This is not proof that the full API or every other source lacks them. [Existing source overview](RPL_SEVEN_SEASON_ENRICHMENT_SOURCES.md).
- There is no verified licensed historical event, tracking, shot-xG, formation-by-minute or lineup-as-of series for M3. Absence must remain explicit, **never replaced by invented proxies**.
- The one-use **2025/26** holdout is consumed. Neither its predictions, labels nor outcomes can be reused for any of these experiments.

## Proposed register

| ID | Research question | Required new data | Cost | Priority |
| --- | --- | --- | --- | --- |
| TACT-01 | Player-pair compatibility | historical verified lineups and substitutions; timestamped player-level event data | high | P3 |
| TACT-02 | Role fit versus nominal position and attack tempo | player positional events; receiving and carry coordinates | high | P3 |
| TACT-03 | Between-lines playmaker access | event positions; opponent line tracking or audited video | high | P3 |
| TACT-04 | Striker contribution without a goal | event data; off-ball movement or video | high | P3 |
| TACT-05 | Receivers ahead of ball and vertical structure | high-frequency tracking; verified event ball coordinates | very_high | P4 |
| TACT-06 | Coordinated pressing rather than individual duel | consistent event pressure definitions; tracking or audited video | high | P3 |
| TACT-07 | Centre-back complementary roles | verified centre-back pairing minutes; event or tracking data | high | P3 |
| TACT-08 | Midfielder role-specific contribution | player role and pairing minutes; event coordinates | high | P3 |
| TACT-09 | Goalkeeper participation in build-up | keeper events and coordinates; pressure context | high | P3 |
| TACT-10 | Score-state bias | verified goal event minutes; penalty and set-piece tags | medium | P1 |
| TACT-11 | Open play, penalties and set pieces | licensed timestamped event/xG data; provider-stable phase and xG definitions | medium | P1 |
| TACT-12 | Substitution and team-structure changes | verified substitution clock; historical team formation changes | high | P3 |
| TACT-13 | Opponent-specific tactical interaction | consistent opponent scheme annotations; event or tracking data | high | P3 |

### Per-hypothesis provenance and validation requirements

All records in the adjacent JSON contain hypothesis wording, source URL, nullable exact-post permalink, separately marked observation and author interpretation, candidate measurements, necessary inputs, test methodology, limitations, priority, and **UNTESTED** status. No player performance numeric rating is recorded.

#### TACT-01: Player-pair compatibility

- **Claim to test:** Role-complementary player pairs may improve ball progression or defensive stability beyond additive individual performance.
- **Illustrative author interpretation, not verified episode:** Zenit: Douglas Santos + Pedro versus Roman Vega + John John (owner-provided author interpretation).
- **Potential observables:** same-minute lineup overlap; passes between pair; progressive passes between pair; chance creation; turnovers; opponent-adjusted open-play xG.
- **Needed source:** historical verified lineups and substitutions; timestamped player-level event data; opponent quality.
- **Method:** Within-club, opponent/score-state/role-adjusted paired-segment contrasts, minimum-minute gate, uncertainty intervals; do not infer causal effect.
- **Current data status:** `not_in_verified_development_sources`; priority `P3`; cost `high`. Exact original post URL and historical as-of availability not established. **No causal or predictive claim.**

#### TACT-02: Role fit versus nominal position and attack tempo

- **Claim to test:** Player role and decision speed can affect team attack tempo independently of individual pace.
- **Illustrative author interpretation, not verified episode:** Luis Enrique: receiving to feet and pausing before dribble (author hypothesis).
- **Potential observables:** receiving zone; touches per possession; ball progression time; off-ball running; role-specific sequence duration.
- **Needed source:** player positional events; receiving and carry coordinates; role annotations.
- **Method:** Compare predefined role-context distributions against match/opponent/score-state controls; require blinded annotations where derived from video.
- **Current data status:** `needs_event_tracking`; priority `P3`; cost `high`. Exact original post URL and historical as-of availability not established. **No causal or predictive claim.**

#### TACT-03: Between-lines playmaker access

- **Claim to test:** A playmaker's effect depends on between-line reception and forward passing options, not merely touch totals.
- **Illustrative author interpretation, not verified episode:** Maxim Glushenkov: between-lines access under centre-versus-wing deployment (author hypothesis).
- **Potential observables:** receptions between lines; progressive passes after receipt; forward teammates; xA from open play; box entries.
- **Needed source:** event positions; opponent line tracking or audited video; player-match role records.
- **Method:** Evaluate predeclared opportunity-normalized metrics by role, opponent and score state.
- **Current data status:** `needs_event_tracking`; priority `P3`; cost `high`. Exact original post URL and historical as-of availability not established. **No causal or predictive claim.**

#### TACT-04: Striker contribution without a goal

- **Claim to test:** A striker may create space, suppress build-up and facilitate other scorers without directly scoring.
- **Illustrative author interpretation, not verified episode:** Alexander Sobolev: centre-back occupation, layoffs, high press and central combination play.
- **Potential observables:** pressured defender actions; layoffs; second balls won; teammate chances in adjacent phases.
- **Needed source:** event data; off-ball movement or video; verified substitutions and opponent roles.
- **Method:** Compare time-on-pitch segments with matched opponent and tactical context; no arbitrary contribution points.
- **Current data status:** `needs_event_tracking`; priority `P3`; cost `high`. Exact original post URL and historical as-of availability not established. **No causal or predictive claim.**

#### TACT-05: Receivers ahead of ball and vertical structure

- **Claim to test:** Excessive build-up support behind the ball may reduce forward passing options and chance quality.
- **Illustrative author interpretation, not verified episode:** Zenit–Rostov 2026-11-08: structural changes after substitutions described by author, not independently established causal explanation.
- **Potential observables:** players ahead of ball; eligible forward receivers; team depth and width; between-lines occupancy; open-play shot quality after changes.
- **Needed source:** high-frequency tracking; verified event ball coordinates; lineup substitutions and video.
- **Method:** Time-segment spatial analysis of build-up phases, controlling game state and opposition reaction.
- **Current data status:** `tracking_required`; priority `P4`; cost `very_high`. Exact original post URL and historical as-of availability not established. **No causal or predictive claim.**

#### TACT-06: Coordinated pressing rather than individual duel

- **Claim to test:** Pressing succeeds when first and second lines act together; isolated pressure may expose transitions.
- **Illustrative author interpretation, not verified episode:** Zenit–Rostov 2026-11-08: author interpretation of pressure sequence preceding opposition transition.
- **Potential observables:** pressing-line spacing; opponent press escapes; PPDA from one consistent provider; dangerous transitions conceded; ball regain latency.
- **Needed source:** consistent event pressure definitions; tracking or audited video; event timing.
- **Method:** Compare pressure episodes and second-line response; separate individual duel from systematic failure.
- **Current data status:** `needs_event_tracking`; priority `P3`; cost `high`. Exact original post URL and historical as-of availability not established. **No causal or predictive claim.**

#### TACT-07: Centre-back complementary roles

- **Claim to test:** Complementary aggressiveness/cover tendencies of centre-back pairs may matter beyond goals conceded.
- **Illustrative author interpretation, not verified episode:** Nino / Kevin Andrade / Alip / Diveev pairing alternatives (author hypothesis).
- **Potential observables:** defender step-outs; covering movements; interceptions; progression starts; transition opportunities.
- **Needed source:** verified centre-back pairing minutes; event or tracking data; opposition strength.
- **Method:** Minute-weighted, season-stratified partial pooling with confidence intervals and opponent/context control.
- **Current data status:** `needs_event_tracking`; priority `P3`; cost `high`. Exact original post URL and historical as-of availability not established. **No causal or predictive claim.**

#### TACT-08: Midfielder role-specific contribution

- **Claim to test:** A midfielder may improve progression beside a defensive specialist while retaining weaknesses defending deeper zones.
- **Illustrative author interpretation, not verified episode:** Artyom Karpukas beside Wilmar Barrios (author hypothesis).
- **Potential observables:** progressive actions by role; press-support actions; positioning errors from audited video; turnovers under pressure.
- **Needed source:** player role and pairing minutes; event coordinates; pressing data.
- **Method:** Separate offensive and defensive facets; reject inference from short goal-involvement streaks.
- **Current data status:** `needs_event_tracking`; priority `P3`; cost `high`. Exact original post URL and historical as-of availability not established. **No causal or predictive claim.**

#### TACT-09: Goalkeeper participation in build-up

- **Claim to test:** Keeper distribution and space coverage can alter attack transition without changes in save rate.
- **Illustrative author interpretation, not verified episode:** Bogdan Moskvichev versus Denis Adamov (author comparison).
- **Potential observables:** passes under pressure; distribution length and completion; actions outside box; transition prevention.
- **Needed source:** keeper events and coordinates; pressure context; historical starter records.
- **Method:** Opponent/pressing-adjusted keeper-role comparison with sample sufficiency.
- **Current data status:** `needs_event_tracking`; priority `P3`; cost `high`. Exact original post URL and historical as-of availability not established. **No causal or predictive claim.**

#### TACT-10: Score-state bias

- **Claim to test:** Aggregate match performance conflates equal-score attack with counters in the lead and game-state-dependent opponent choices.
- **Illustrative author interpretation, not verified episode:** Krylya Sovetov–Zenit 2026-11-02 (0:3): goals/penalties change the game context; illustrative only.
- **Potential observables:** shots and xG at 0:0; open-play xG while leading/trailing; score-state possession and passes; time elapsed in state.
- **Needed source:** verified goal event minutes; penalty and set-piece tags; timestamped event/xG product.
- **Method:** Within-match time-at-risk denominators and causal caveats; as-of lag for any pregame feature; stratify by opponent/time.
- **Current data status:** `needs_event_data`; priority `P1`; cost `medium`. Exact original post URL and historical as-of availability not established. **No causal or predictive claim.**

#### TACT-11: Open play, penalties and set pieces

- **Claim to test:** Total xG hides material distinctions between open-play and dead-ball creation.
- **Illustrative author interpretation, not verified episode:** Zenit–Krylya 2026-11-02 (0:3) context in owner brief; source match score independently verified.
- **Potential observables:** non-penalty xG; open-play xG; set-piece xG; shots and box entries by phase.
- **Needed source:** licensed timestamped event/xG data; provider-stable phase and xG definitions; first availability proof.
- **Method:** Train only on prior matches with verified provenance; separate providers; compare per-season ablation on locked folds.
- **Current data status:** `needs_event_data`; priority `P1`; cost `medium`. Exact original post URL and historical as-of availability not established. **No causal or predictive claim.**

#### TACT-12: Substitution and team-structure changes

- **Claim to test:** Post-substitution change depends on whole-team structure rather than an outgoing player's isolated output.
- **Illustrative author interpretation, not verified episode:** Zenit–Rostov 2026-11-08: changes involving Wendel, Diveev and injury to Mantuan are author-supplied context pending independent event audit.
- **Potential observables:** minute of substitution; score at intervention; pre/post positional structure; progression and transition outcomes.
- **Needed source:** verified substitution clock; historical team formation changes; event/tracking data; injury source if claimed.
- **Method:** Compare matched pre/post windows with opponent reaction and regression-to-mean caveats, never infer coach intent.
- **Current data status:** `needs_event_tracking`; priority `P3`; cost `high`. Exact original post URL and historical as-of availability not established. **No causal or predictive claim.**

#### TACT-13: Opponent-specific tactical interaction

- **Claim to test:** Tactical style effectiveness may depend on opponent press/block structure and formation interactions.
- **Illustrative author interpretation, not verified episode:** Zenit position/line balance changes in response to opponent (author-generalized hypothesis).
- **Potential observables:** opponent-press category; attack entries against low block; transition opportunities against high line; opponent-adjusted progression.
- **Needed source:** consistent opponent scheme annotations; event or tracking data; pre-kickoff availability for target opponent.
- **Method:** Pre-register interactions with regularization; compare pooled walk-forward per season; disallow post-match scouting notes as pregame truth.
- **Current data status:** `needs_event_tracking`; priority `P3`; cost `high`. Exact original post URL and historical as-of availability not established. **No causal or predictive claim.**

## Availability and feasibility by source class

| Source class | Current evidence | Permitted next step | Prohibited leap |
| --- | --- | --- | --- |
| Match schedules, prior played results, club history | Pure prior-day computation exists; private season-to-season continuity and scored-match eligibility unresolved | Continue M3-A3 source reconciliation, then test conservative **previous-match-only** team aggregates if individually admissible | Present-day provider score as historically available played goal |
| Match state and goal-minute event log | Example public match chronologies exist; seven-season licensed, time-attested event coverage unproven | Obtain independently licensed and publication-audited event history with score states | Use target-match goals, penalties or score states before its kickoff |
| Open-play / set-piece / penalty xG | No verified seven-season xG snapshots; vendor definitions may differ | Provider-specific event schema, original observation/as-of evidence, season-level missingness audit | Mix providers or estimate numeric xG from narrative |
| Lineups, player roles, compatibility | Earlier historical 350-row sample did not expose fields, **global absence unknown** | Audit legally permitted historic starter/substitute records and first announcement times | Assume pre-announcement lineups or compute subjective compatibility ratings |
| Positions, receiver availability, synchronized pressing | No authenticated tracking/video series | Tracking/event licensing, cross-team timestamps, audited annotation and rights | Infer off-ball geometry from final scores or season tables |
| Commentary / channel posts | Qualitative secondary source only, selected channel excerpts | Locate **exact original per-post URL**, time, author observation vs inference, then use only for research design | Treat opinion as ground-truth player skill or post-match prediction input |

## Prioritization without diverting M3-A3

1. **P0, current critical path:** finish A3 eligibility, public/private fixture identity, played vs awarded, original UTC and source rights. No real tactical challenger before source approval.
2. **P1, first conditional challenger:** score-state and open-play/penalty/set-piece decomposition from verified **past-match** events, if legal historical event/xG data and pre-cutoff publication evidence exist. Freeze one feature definition and missingness/abstention rules before validation. If not available, stop at feasibility report.
3. **P2:** low-cost team-only pregame aggregates using existing earlier-match outcomes after A3, as control baseline (not proof of player tactics).
4. **P3:** player pairing, roles, keeper, pressing and substitutions only after source-level minute, lineup and event audits.
5. **P4:** geometry and off-ball tactical shape require licensed tracking or independently audited video annotations.

## Experimental protocol

Compare a **pre-registered** challenger to the unchanged frequency baseline and frozen synthetic team Poisson only on approved eligible 2018/19–2024/25 history. Use the existing fixed F1–F5 training/validation season plan, at the fixed as-of cutoff; absolutely no training-year/target-game label leakage. Before scoring register source versions, feature definitions, missing-data policy, minimum eligible N, exclusion reasons, expected directions, family-level multiplicity control and stop criteria.

Report each fold's paired eligible N, abstentions, coverage, Multiclass Log Loss, summed Brier, RPS, calibration and uncertainty intervals; include favorite/draw and incomplete-data slices. Never claim improvement from one Zenit match, point-estimate gain without uncertainty, or a match-state correlation as causal. Do not change production predictions, M2 escrow, existing RLS, public endpoints, or published historical forecasts. Any UI extension must mark expert hypotheses separately from calibrated probabilities and remain within existing owner-facing pages. Nothing in this research registry advances **M3 beyond 2/8**.

## Remaining verification
Exact original channel per-post links/timestamps; license and available event/lineup/tracking history for each development season; source rights; true row-level eligible match counts; out-of-sample validation. Blocked by [M3-A3](https://github.com/StanleyLl0yd/FootballForecast/issues/271).
