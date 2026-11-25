-- M4-A6: private, append-only UNATTESTED evidence and candidate revisions.
-- NOT a settlement, source authentication, KDK clearance or scoring API.
-- The separately reviewed protected worker must verify pinned publisher URLs,
-- independent editorial provenance, exact A5 crosswalk, raw bodies and GitHub
-- OIDC RS256 audience/clock, plus a complete dated RFS/KDK review.
-- No live application, data collection or write authority is granted here.

create table ff_private.ff_m4_result_observations (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references ff_private.ff_m4_future_captures(id),
  observation_revision integer not null check (observation_revision > 0),
  source_issuer text not null check (
    source_issuer in ('openfoot','matchtv','official_club','rpl_protocol','rfs_kdk')),
  source_publisher text not null check (source_publisher ~ '^[a-z0-9_:-]{2,160}$'),
  source_fixture_ref text not null check (
    source_fixture_ref ~ '^[A-Za-z0-9_.:-]{2,160}$'),
  -- A locator is retained evidence, NEVER an instruction to fetch a URL.
  source_locator text check (source_locator is null or
    (length(source_locator) between 12 and 2048 and
     source_locator ~ '^https://[A-Za-z0-9.-]+/[^[:space:]#]+$')),
  source_response_sha256 text not null check (
    source_response_sha256 ~ '^[a-f0-9]{64}$'),
  -- Exact canonical metadata bytes, never a raw publisher body.
  source_context_manifest bytea,
  source_context_manifest_sha256 text,
  source_oidc_jwt text not null
    check (length(source_oidc_jwt) between 400 and 10000),
  source_jwk jsonb not null check (jsonb_typeof(source_jwk) = 'object'),
  source_token_sha256 text not null unique check (
    source_token_sha256 ~ '^[a-f0-9]{64}$' and
    source_token_sha256 =
      encode(sha256(convert_to(source_oidc_jwt,'UTF8')),'hex')),
  source_issued_at timestamptz not null,
  github_run_id bigint not null check (github_run_id > 0),
  github_run_attempt integer not null check (github_run_attempt > 0),
  code_sha text not null check (code_sha ~ '^[a-f0-9]{40}$'),
  fixture_key text not null,
  kickoff_at timestamptz not null,
  home_club_key text not null,
  away_club_key text not null,
  status text not null,
  result_kind text not null,
  home_goals integer check (home_goals between 0 and 20),
  away_goals integer check (away_goals between 0 and 20),
  -- Ordered credited clubs from a complete *claimed* counted-goal sequence.
  -- The protected parser must independently validate full-time events and
  -- source running scores. NULL is unknown; an empty array is explicit 0:0.
  counted_goal_clubs text[],
  kdk_scope_from timestamptz,
  kdk_scope_through timestamptz,
  kdk_scope_sha256 text check (kdk_scope_sha256 ~ '^[a-f0-9]{64}$'),
  kdk_decision_ref text check (
    kdk_decision_ref ~ '^https://www[.]rfs[.]ru/news/[0-9]+$' and
    kdk_decision_ref <> 'https://www.rfs.ru/news/225644'),
  kdk_decision_sha256 text check (kdk_decision_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz not null default clock_timestamp(),
  result_attested boolean not null default false check (result_attested = false),
  publication_allowed boolean not null default false check (publication_allowed = false),
  holdout_2025_26_read boolean not null default false check (holdout_2025_26_read = false),
  check ((home_goals is null) = (away_goals is null)),
  check ((source_context_manifest is null) = (source_context_manifest_sha256 is null)),
  check (source_context_manifest is null or (
    source_issuer in ('official_club','rpl_protocol') and
    status='on_field_full_time_claim' and
    octet_length(source_context_manifest) between 2 and 32768 and
    source_context_manifest_sha256 ~ '^[a-f0-9]{64}$' and
    source_context_manifest_sha256=encode(sha256(source_context_manifest),'hex'))),
  check ((kdk_decision_ref is null) = (kdk_decision_sha256 is null)),
  check (
    (source_issuer='openfoot' and source_publisher='openfoot' and
     home_goals is not null and counted_goal_clubs is null and
     ((status='finished' and result_kind='played') or
      (status='score_displayed_unverified' and result_kind='unknown')))
    or
    (source_issuer='matchtv' and source_publisher='matchtv' and
     home_goals is not null and counted_goal_clubs is null and
     status='score_displayed_unverified' and result_kind='unknown')
    or
    (source_issuer in ('official_club','rpl_protocol') and source_locator is not null and
     ((status='on_field_full_time_claim' and result_kind='played' and
       home_goals is not null and counted_goal_clubs is not null) or
      (status='official_unresolved' and result_kind='unknown' and counted_goal_clubs is null)))
    or
    (source_issuer='rfs_kdk' and source_publisher='rfs' and
     source_locator is not null and result_kind='unknown' and
     home_goals is null and counted_goal_clubs is null and
     status in ('kdk_pending','kdk_ambiguous','kdk_adverse','kdk_reviewed_no_adverse_claim'))
  ),
  check (
    (source_issuer='rfs_kdk' and kdk_scope_from is not null and
     kdk_scope_through is not null and kdk_scope_sha256 is not null and
     (status <> 'kdk_adverse' or kdk_decision_ref is not null))
    or
    (source_issuer <> 'rfs_kdk' and kdk_scope_from is null and
     kdk_scope_through is null and kdk_scope_sha256 is null and
     kdk_decision_ref is null and kdk_decision_sha256 is null)
  ),
  -- Re-observing unchanged bytes in a later protected run is legitimate.
  -- A token or an issuer/publisher within the same capture/run cannot replay.
  unique (capture_id,observation_revision),
  unique (capture_id,github_run_id,github_run_attempt,source_issuer,source_publisher)
);
create index ff_m4_result_observation_capture_idx
  on ff_private.ff_m4_result_observations(capture_id,recorded_at);

create table ff_private.ff_m4_result_candidate_settlements (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references ff_private.ff_m4_future_captures(id),
  shadow_entry_id uuid not null references ff_private.ff_m4_shadow_entries(id),
  primary_observation_id uuid references ff_private.ff_m4_result_observations(id),
  corroboration_observation_id uuid references ff_private.ff_m4_result_observations(id),
  official_observation_id uuid references ff_private.ff_m4_result_observations(id),
  second_official_observation_id uuid references ff_private.ff_m4_result_observations(id),
  kdk_observation_id uuid references ff_private.ff_m4_result_observations(id),
  revision integer not null check (revision between 1 and 100),
  previous_settlement_id uuid references ff_private.ff_m4_result_candidate_settlements(id),
  -- Set by DB under the same capture lock as observation insertion. Any later
  -- observation makes this revision stale, regardless of its claimed score.
  evidence_cutoff_revision integer not null check (evidence_cutoff_revision > 0),
  home_goals integer check (home_goals between 0 and 20),
  away_goals integer check (away_goals between 0 and 20),
  recorded_at timestamptz not null default clock_timestamp(),
  state text not null default 'PRIVATE_RESULT_CANDIDATE_UNATTESTED'
    check (state in ('PRIVATE_RESULT_CANDIDATE_UNATTESTED','PRIVATE_RESULT_BLOCKED')),
  blocking_reason text check (blocking_reason in (
    'MISSING_EVIDENCE','CONTRADICTORY_EVIDENCE','KDK_UNRESOLVED',
    'OFFICIAL_CHANGE','SUPERSEDED_FORECAST','REVIEW_REQUIRED')),
  settlement_authorized boolean not null default false check (settlement_authorized = false),
  scoring_authorized boolean not null default false check (scoring_authorized = false),
  played_final_attested boolean not null default false check (played_final_attested = false),
  kdk_clearance_attested boolean not null default false check (kdk_clearance_attested = false),
  model_approved boolean not null default false check (model_approved = false),
  publication_allowed boolean not null default false check (publication_allowed = false),
  holdout_2025_26_read boolean not null default false check (holdout_2025_26_read = false),
  check (
    (state='PRIVATE_RESULT_CANDIDATE_UNATTESTED' and blocking_reason is null and
     primary_observation_id is not null and corroboration_observation_id is not null and
     official_observation_id is not null and kdk_observation_id is not null and
     home_goals is not null and away_goals is not null)
    or
    (state='PRIVATE_RESULT_BLOCKED' and blocking_reason is not null and
     home_goals is null and away_goals is null)
  ),
  unique (capture_id,revision)
);
create index ff_m4_result_settlement_capture_idx
  on ff_private.ff_m4_result_candidate_settlements(capture_id,recorded_at);

create function ff_private.ff_m4_result_observation_insert_guard()
returns trigger language plpgsql set search_path = '' as $m4$
declare
  v_cap record;
  v_proof record;
  v_now timestamptz;
  v_goal text;
  v_home integer := 0;
  v_away integer := 0;
  v_prior_kdk ff_private.ff_m4_result_observations%rowtype;
  v_context jsonb;
  v_claim jsonb;
  v_expected_goals jsonb;
  v_receipt_publisher text;
  v_observed timestamptz;
begin
  -- Both appenders serialize on the immutable capture row. At READ COMMITTED
  -- subsequent queries in these volatile trigger functions see committed
  -- predecessor rows. Reject stale-snapshot isolation rather than guess.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'M4 result evidence requires read committed';
  end if;
  select fixture_key,competition,season,kickoff_at,home_club_key,away_club_key,captured_at
    into v_cap from ff_private.ff_m4_future_captures where id=new.capture_id for update;
  select source_match_id,committed_at into v_proof
    from ff_private.ff_m4_time_proofs where capture_id=new.capture_id for share;
  v_now := clock_timestamp();
  new.recorded_at := v_now;
  if v_cap.fixture_key is null or v_proof.source_match_id is null
     or v_cap.competition <> 'RPL' or v_cap.season <> '2026/27'
     or new.fixture_key is distinct from v_cap.fixture_key
     or new.kickoff_at is distinct from v_cap.kickoff_at
     or new.home_club_key is distinct from v_cap.home_club_key
     or new.away_club_key is distinct from v_cap.away_club_key
     or (new.source_issuer='openfoot' and
         new.source_fixture_ref is distinct from v_proof.source_match_id)
     or (new.source_issuer='matchtv' and
         (new.source_fixture_ref !~ '^matchtv:[0-9]{6,20}$' or
          new.source_fixture_ref = v_proof.source_match_id))
     or (new.source_issuer='official_club' and
         new.source_publisher not in (v_cap.home_club_key,v_cap.away_club_key))
     or (new.source_issuer='rpl_protocol' and new.source_publisher <> 'rpl')
     or v_cap.captured_at >= v_cap.kickoff_at - interval '15 minutes'
     or v_proof.committed_at >= v_cap.kickoff_at - interval '15 minutes'
     or new.source_issued_at < v_cap.kickoff_at + interval '90 minutes'
     or v_now < v_cap.kickoff_at + interval '90 minutes'
     or new.source_issued_at > v_now
     or new.source_issued_at < v_now - interval '20 minutes'
     or new.source_issued_at <= v_proof.committed_at then
    raise exception 'M4 result observation lacks fresh A5-linked postgame proof';
  end if;
  -- A delayed older runner receipt cannot supersede a newer publisher
  -- observation, even if it is still within the permitted insertion window.
  if exists (select 1 from ff_private.ff_m4_result_observations o
      where o.capture_id=new.capture_id and o.source_issuer=new.source_issuer
        and o.source_publisher=new.source_publisher
        and o.source_issued_at>=new.source_issued_at) then
    raise exception 'M4 publisher observation clock did not advance';
  end if;
  if new.counted_goal_clubs is not null then
    if cardinality(new.counted_goal_clubs)>40 or
       (cardinality(new.counted_goal_clubs)>0 and
        (array_ndims(new.counted_goal_clubs) is distinct from 1 or
         array_lower(new.counted_goal_clubs,1) is distinct from 1)) then
      raise exception 'M4 invalid counted goal sequence';
    end if;
    foreach v_goal in array new.counted_goal_clubs loop
      if v_goal=v_cap.home_club_key then v_home := v_home+1;
      elsif v_goal=v_cap.away_club_key then v_away := v_away+1;
      else raise exception 'M4 invalid counted goal sequence';
      end if;
    end loop;
    if v_home is distinct from new.home_goals or v_away is distinct from new.away_goals then
      raise exception 'M4 invalid counted goal sequence';
    end if;
  end if;
  if new.source_context_manifest is not null then
    -- Structural linkage only, not signature or canonical encoding validation.
    if new.source_issuer not in ('official_club','rpl_protocol')
       or new.status<>'on_field_full_time_claim'
       or octet_length(new.source_context_manifest) not between 2 and 32768 then
      raise exception 'M4 context manifest requires bounded official full-time claim';
    end if;
    v_context := convert_from(new.source_context_manifest,'UTF8')::jsonb;
    v_receipt_publisher := case when new.source_issuer='rpl_protocol'
      then 'rpl_protocol:'||new.source_fixture_ref else new.source_publisher end;
    if jsonb_typeof(v_context) is distinct from 'object'
       or v_context->>'schema' is distinct from 'ff-m4-official-witness-context-v1'
       or v_context->>'receiptPublisher' is distinct from v_receipt_publisher
       or (v_context->'fixture' @> jsonb_build_object(
         'fixtureKey',v_cap.fixture_key,'sourceMatchId',v_proof.source_match_id,
         'competition',v_cap.competition,'season',v_cap.season,'round',15,
         'homeClub',v_cap.home_club_key,'awayClub',v_cap.away_club_key)) is distinct from true
       or (v_context#>>'{fixture,kickoffAt}')::timestamptz is distinct from v_cap.kickoff_at
       or jsonb_typeof(v_context->'providerClaims') is distinct from 'array'
       or jsonb_typeof(v_context->'witnessClaims') is distinct from 'array' then
      raise exception 'M4 context manifest identity mismatch';
    end if;
    if jsonb_array_length(v_context->'providerClaims')<>2
       or v_context#>>'{providerClaims,0,issuer}' is distinct from 'openfoot'
       or v_context#>>'{providerClaims,1,issuer}' is distinct from 'matchtv'
       or (new.source_issuer='rpl_protocol' and (
         v_context->>'evidenceRoute' is distinct from 'PROTOCOL_REFERENCE'
         or jsonb_array_length(v_context->'witnessClaims')<>1))
       or (new.source_issuer='official_club' and (
         v_context->>'evidenceRoute' is distinct from 'OPPOSING_CLUB_REPORTS'
         or jsonb_array_length(v_context->'witnessClaims')<>2
         or (v_context->'witnessClaims' @> jsonb_build_array(
           jsonb_build_object('publisher',v_cap.home_club_key),
           jsonb_build_object('publisher',v_cap.away_club_key))) is distinct from true)) then
      raise exception 'M4 context manifest route mismatch';
    end if;
    select value into v_claim from jsonb_array_elements(v_context->'witnessClaims')
      where value->>'publisher'=v_receipt_publisher;
    select coalesce(jsonb_agg(jsonb_build_array(g.club,g.h,g.a) order by g.ord),'[]'::jsonb)
      into v_expected_goals
      from (select club,ord,
        count(*) filter (where club=new.home_club_key) over (order by ord) as h,
        count(*) filter (where club=new.away_club_key) over (order by ord) as a
        from unnest(new.counted_goal_clubs) with ordinality as goal(club,ord)) g;
    v_observed := (v_claim->>'observedAt')::timestamptz;
    if v_claim is null or v_claim->>'locator' is distinct from new.source_locator
       or v_claim->>'bodySha256' is distinct from new.source_response_sha256
       or v_claim->'score' is distinct from to_jsonb(array[new.home_goals,new.away_goals])
       or v_claim->'events' is distinct from
          jsonb_build_array('KICKOFF','HALF_TIME','SECOND_HALF','FULL_TIME')
       or v_claim->'goals' is distinct from v_expected_goals
       or v_observed is null or v_observed<new.kickoff_at+interval '90 minutes'
       or date_trunc('second',v_observed)>new.source_issued_at
       or v_observed<new.source_issued_at-interval '5 minutes' then
      raise exception 'M4 context manifest witness mismatch';
    end if;
  end if;
  if new.source_issuer='rfs_kdk' then
    if new.source_locator is null or not (
         new.source_locator='https://www.rfs.ru/archive?tags=16' or
         new.source_locator ~ '^https://www[.]rfs[.]ru/news/[0-9]+$')
       or new.kdk_scope_from is null or new.kdk_scope_through is null
       or new.kdk_scope_from < '2026-07-01T00:00:00Z'::timestamptz
       or new.kdk_scope_from > v_cap.kickoff_at
       or new.kdk_scope_through < v_cap.kickoff_at + interval '90 minutes'
       or new.kdk_scope_through > new.source_issued_at then
      raise exception 'M4 invalid dated KDK review scope';
    end if;
    select * into v_prior_kdk from ff_private.ff_m4_result_observations
      where capture_id=new.capture_id and source_issuer='rfs_kdk'
      order by observation_revision desc limit 1;
    if new.status='kdk_reviewed_no_adverse_claim' then
      -- A scheduled hearing date passing, or a generic archive search, is not
      -- a resolution. Known pending round-15 cases require a claimed issued
      -- decision even if the worker has not yet retained the agenda itself.
      if (v_cap.fixture_key in (
            'rpl-2026-27-r15-20261121-1000','rpl-2026-27-r15-20261121-1215',
            'rpl-2026-27-r15-20261121-1645','rpl-2026-27-r15-20261122-1100')
          or v_prior_kdk.status in ('kdk_pending','kdk_ambiguous','kdk_adverse')
          or v_prior_kdk.kdk_decision_ref is not null)
         and new.kdk_decision_ref is null then
        raise exception 'M4 unresolved KDK proceeding requires issued decision evidence';
      end if;
      if new.source_locator='https://www.rfs.ru/news/225644' then
        raise exception 'M4 hearing agenda is not an issued disposition';
      end if;
      if exists (select 1 from ff_private.ff_m4_result_observations prior
           where prior.capture_id=new.capture_id and prior.source_issuer='rfs_kdk'
             and prior.status='kdk_adverse'
             and (new.kdk_decision_ref is not distinct from prior.kdk_decision_ref
               or new.kdk_decision_sha256 is not distinct from prior.kdk_decision_sha256)) then
        raise exception 'M4 adverse decision cannot clear itself';
      end if;
    end if;
    if v_prior_kdk.id is not null and
       (new.kdk_scope_through < v_prior_kdk.kdk_scope_through or
        new.kdk_scope_from > v_prior_kdk.kdk_scope_from) then
      raise exception 'M4 KDK review scope regressed';
    end if;
  end if;
  select coalesce(max(observation_revision),0)+1 into new.observation_revision
    from ff_private.ff_m4_result_observations where capture_id=new.capture_id;
  return new;
end;
$m4$;

create function ff_private.ff_m4_result_candidate_insert_guard()
returns trigger language plpgsql set search_path = '' as $m4$
declare
  v_cap record;
  v_entry record;
  v_primary ff_private.ff_m4_result_observations%rowtype;
  v_other ff_private.ff_m4_result_observations%rowtype;
  v_official ff_private.ff_m4_result_observations%rowtype;
  v_second ff_private.ff_m4_result_observations%rowtype;
  v_kdk ff_private.ff_m4_result_observations%rowtype;
  v_previous ff_private.ff_m4_result_candidate_settlements%rowtype;
  v_ids uuid[];
  v_now timestamptz;
  v_context jsonb;
  v_peer_context jsonb;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'M4 result evidence requires read committed';
  end if;
  select kickoff_at,fixture_key into v_cap
    from ff_private.ff_m4_future_captures where id=new.capture_id for update;
  select capture_id,fixture_key,revision,model_id,entry_kind,committed_at into v_entry
    from ff_private.ff_m4_shadow_entries where id=new.shadow_entry_id for share;
  v_now := clock_timestamp();
  new.recorded_at := v_now;
  select coalesce(max(observation_revision),0) into new.evidence_cutoff_revision
    from ff_private.ff_m4_result_observations where capture_id=new.capture_id;
  if v_cap.fixture_key is null or v_entry.fixture_key is null
     or v_entry.capture_id <> new.capture_id or v_entry.fixture_key <> v_cap.fixture_key
     or v_entry.entry_kind <> 'FORECAST'
     or v_entry.committed_at > v_cap.kickoff_at - interval '15 minutes'
     or v_now < v_cap.kickoff_at + interval '90 minutes'
     or new.evidence_cutoff_revision=0 then
    raise exception 'M4 candidate lacks valid pregame FORECAST or evidence';
  end if;
  select * into v_primary from ff_private.ff_m4_result_observations where id=new.primary_observation_id;
  select * into v_other from ff_private.ff_m4_result_observations where id=new.corroboration_observation_id;
  select * into v_official from ff_private.ff_m4_result_observations where id=new.official_observation_id;
  select * into v_second from ff_private.ff_m4_result_observations where id=new.second_official_observation_id;
  select * into v_kdk from ff_private.ff_m4_result_observations where id=new.kdk_observation_id;
  if (new.primary_observation_id is not null and
       (v_primary.capture_id is distinct from new.capture_id or v_primary.source_issuer is distinct from 'openfoot'))
     or (new.corroboration_observation_id is not null and
       (v_other.capture_id is distinct from new.capture_id or v_other.source_issuer is distinct from 'matchtv'))
     or (new.official_observation_id is not null and
       (v_official.capture_id is distinct from new.capture_id or
        v_official.source_issuer not in ('official_club','rpl_protocol')))
     or (new.second_official_observation_id is not null and
       (v_second.capture_id is distinct from new.capture_id or v_second.source_issuer is distinct from 'official_club'))
     or (new.kdk_observation_id is not null and
       (v_kdk.capture_id is distinct from new.capture_id or v_kdk.source_issuer is distinct from 'rfs_kdk')) then
    raise exception 'M4 result evidence role or capture mismatch';
  end if;
  select * into v_previous from ff_private.ff_m4_result_candidate_settlements
    where capture_id=new.capture_id order by revision desc limit 1;
  if (v_previous.id is null and (new.revision<>1 or new.previous_settlement_id is not null))
     or (v_previous.id is not null and
        (new.previous_settlement_id is distinct from v_previous.id
         or new.revision<>v_previous.revision+1
         or new.shadow_entry_id is distinct from v_previous.shadow_entry_id
         or new.evidence_cutoff_revision<v_previous.evidence_cutoff_revision
         or (new.evidence_cutoff_revision=v_previous.evidence_cutoff_revision
           and (new.state<>'PRIVATE_RESULT_BLOCKED' or
                v_previous.state='PRIVATE_RESULT_BLOCKED')))) then
    raise exception 'M4 result revision lineage invalid';
  end if;
  -- A blocked revision is not a result: no score and no authority. It may
  -- preserve missing/contradictory evidence or a superseded FORECAST.
  if new.state='PRIVATE_RESULT_BLOCKED' then return new; end if;
  if new.state is distinct from 'PRIVATE_RESULT_CANDIDATE_UNATTESTED'
     or v_primary.id is null or v_other.id is null or v_official.id is null or v_kdk.id is null
     or v_official.status is distinct from 'on_field_full_time_claim'
     or v_kdk.status is distinct from 'kdk_reviewed_no_adverse_claim'
     or v_kdk.observation_revision<>new.evidence_cutoff_revision
     or new.home_goals is distinct from v_primary.home_goals
     or new.away_goals is distinct from v_primary.away_goals
     or v_other.home_goals is distinct from v_primary.home_goals
     or v_other.away_goals is distinct from v_primary.away_goals
     or v_official.home_goals is distinct from v_primary.home_goals
     or v_official.away_goals is distinct from v_primary.away_goals
     or not (
       (v_official.source_issuer='rpl_protocol' and v_second.id is null) or
       (v_official.source_issuer='official_club' and v_second.id is not null and
        v_official.source_publisher<>v_second.source_publisher and
        v_second.status='on_field_full_time_claim' and
        v_second.home_goals=v_primary.home_goals and v_second.away_goals=v_primary.away_goals and
        v_second.counted_goal_clubs=v_official.counted_goal_clubs))
     or v_kdk.kdk_scope_through < (
       select max(source_issued_at) from ff_private.ff_m4_result_observations o
       where o.capture_id=new.capture_id and o.observation_revision<new.evidence_cutoff_revision)
     or exists (select 1 from ff_private.ff_m4_shadow_entries e
       where e.fixture_key=v_cap.fixture_key and e.model_id=v_entry.model_id
         and e.revision>v_entry.revision) then
    raise exception 'M4 candidate lacks consistent official/KDK evidence';
  end if;
  v_ids := array_remove(array[v_primary.id,v_other.id,v_official.id,v_second.id,v_kdk.id],null);
  if (select count(distinct source_response_sha256)
        from ff_private.ff_m4_result_observations where id=any(v_ids))<>cardinality(v_ids)
     or exists (
       select 1 from ff_private.ff_m4_result_observations selected
       join ff_private.ff_m4_result_observations newer
         on newer.capture_id=selected.capture_id and newer.source_issuer=selected.source_issuer
         and newer.source_publisher=selected.source_publisher
         and newer.observation_revision>selected.observation_revision
       where selected.id=any(v_ids))
     or exists (
       -- A conflicting latest report cannot be hidden by selecting a
       -- convenient protocol or opposing-club pair. Only a new source claim
       -- from that publisher can supersede its earlier observation.
       select 1 from ff_private.ff_m4_result_observations o
       where o.capture_id=new.capture_id and o.source_issuer in ('official_club','rpl_protocol')
         and not exists (select 1 from ff_private.ff_m4_result_observations n
           where n.capture_id=o.capture_id and n.source_issuer=o.source_issuer
             and n.source_publisher=o.source_publisher and n.observation_revision>o.observation_revision)
         and (o.status<>'on_field_full_time_claim'
           or o.home_goals is distinct from v_primary.home_goals
           or o.away_goals is distinct from v_primary.away_goals
           or o.counted_goal_clubs is distinct from v_official.counted_goal_clubs)) then
    raise exception 'M4 duplicate, stale or contradictory result evidence';
  end if;
  -- Never combine a context-bound witness with a raw-only peer or a
  -- different batch. Raw-only candidates remain UNATTESTED structural rows,
  -- not a permitted operational fallback for a future protected worker.
  if v_official.source_context_manifest is not null
     or v_second.source_context_manifest is not null then
    if v_official.source_context_manifest is null
       or (v_second.id is not null and v_second.source_context_manifest is null) then
      raise exception 'M4 context manifest batch incomplete';
    end if;
    v_context := convert_from(v_official.source_context_manifest,'UTF8')::jsonb;
    if v_second.id is not null then
      v_peer_context := convert_from(v_second.source_context_manifest,'UTF8')::jsonb;
      if (v_context-'receiptPublisher') is distinct from (v_peer_context-'receiptPublisher') then
        raise exception 'M4 context manifest batch mismatch';
      end if;
    end if;
    if (v_context->'providerClaims'->0 @> jsonb_build_object(
          'issuer','openfoot','sourceFixtureRef',v_primary.source_fixture_ref,
          'bodySha256',v_primary.source_response_sha256,'status',v_primary.status,
          'resultKind',v_primary.result_kind,
          'score',to_jsonb(array[v_primary.home_goals,v_primary.away_goals]))) is distinct from true
       or (v_context->'providerClaims'->1 @> jsonb_build_object(
          'issuer','matchtv','sourceFixtureRef',v_other.source_fixture_ref,
          'bodySha256',v_other.source_response_sha256,'status',v_other.status,
          'resultKind',v_other.result_kind,
          'score',to_jsonb(array[v_other.home_goals,v_other.away_goals]))) is distinct from true then
      raise exception 'M4 context manifest provider mismatch';
    end if;
  end if;
  return new;
end;
$m4$;

revoke all on function ff_private.ff_m4_result_observation_insert_guard()
  from public,anon,authenticated,service_role;
revoke all on function ff_private.ff_m4_result_candidate_insert_guard()
  from public,anon,authenticated,service_role;

create trigger ff_m4_result_observation_server_clock before insert
  on ff_private.ff_m4_result_observations for each row
  execute function ff_private.ff_m4_result_observation_insert_guard();
create trigger ff_m4_result_candidate_server_clock before insert
  on ff_private.ff_m4_result_candidate_settlements for each row
  execute function ff_private.ff_m4_result_candidate_insert_guard();

alter table ff_private.ff_m4_result_observations enable row level security;
alter table ff_private.ff_m4_result_observations force row level security;
alter table ff_private.ff_m4_result_candidate_settlements enable row level security;
alter table ff_private.ff_m4_result_candidate_settlements force row level security;
revoke all on ff_private.ff_m4_result_observations,
  ff_private.ff_m4_result_candidate_settlements
  from public,anon,authenticated,service_role;

create trigger ff_m4_result_observations_immutable before update or delete
  on ff_private.ff_m4_result_observations for each row
  execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m4_result_observations_no_truncate before truncate
  on ff_private.ff_m4_result_observations for each statement
  execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m4_candidate_results_immutable before update or delete
  on ff_private.ff_m4_result_candidate_settlements for each row
  execute function ff_private.ff_reject_ingest_mutation();
create trigger ff_m4_candidate_results_no_truncate before truncate
  on ff_private.ff_m4_result_candidate_settlements for each statement
  execute function ff_private.ff_reject_ingest_mutation();

comment on table ff_private.ff_m4_result_observations is
 'Private unverified source claims, raw-body digest and runner token; UNKNOWN is not played-final.';
comment on table ff_private.ff_m4_result_candidate_settlements is
 'Append-only UNATTESTED candidates/blocks. Any later observation supersedes the evidence cutoff. No settlement, scoring or publication authority.';
