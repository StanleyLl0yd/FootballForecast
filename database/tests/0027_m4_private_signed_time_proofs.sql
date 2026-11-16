-- Synthetic, transaction-rolled-back M4-A5 proof linkage and RLS tests.
begin;
do $proof$
declare
  v_capture uuid;
  v_source text := repeat('a', 512);
  v_kickoff text := repeat('b', 512);
  v_source_sha text;
  v_kickoff_sha text;
  v_source_at timestamptz := clock_timestamp()-interval '10 seconds';
  v_kickoff_at timestamptz := clock_timestamp()-interval '5 seconds';
  v_proof uuid;
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='ff_private' and c.relname='ff_m4_time_proofs'
    and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) or (select count(*) from pg_class c join pg_namespace n
       on n.oid=c.relnamespace where n.nspname='ff_private'
       and c.relname='ff_m4_time_proofs') <> 1
  or has_table_privilege('anon','ff_private.ff_m4_time_proofs','SELECT')
  or has_table_privilege('authenticated','ff_private.ff_m4_time_proofs','SELECT')
  or has_table_privilege('service_role','ff_private.ff_m4_time_proofs','SELECT')
  or has_table_privilege('anon','ff_private.ff_m4_time_proofs','INSERT')
  or has_table_privilege('service_role','ff_private.ff_m4_time_proofs','INSERT') then
    raise exception 'M4 signed proof private privilege boundary failed';
  end if;
  v_source_sha := encode(sha256(convert_to(v_source,'UTF8')),'hex');
  v_kickoff_sha := encode(sha256(convert_to(v_kickoff,'UTF8')),'hex');
  insert into ff_private.ff_m4_future_captures
    (fixture_key,competition,season,home_club_key,away_club_key,
     kickoff_at,status,revision_kind,source_revision_sha256,
     kickoff_evidence_sha256,team_mapping_sha256,source_issuer,
     kickoff_issuer,source_mac_sha256,kickoff_mac_sha256,
     source_observed_at,kickoff_observed_at)
  values
    ('rpl-synthetic-a5-proof','RPL','2026/27','zenit','rubin',
     clock_timestamp()+interval '3 days','scheduled','none',
     repeat('1',64),repeat('2',64),encode(sha256(convert_to(concat_ws(chr(10),
       'rpl-synthetic-a5-proof','match-synthetic','zenit','team-zenit',
       'rubin','team-rubin') || chr(10),'UTF8')),'hex'),'openfoot',
     'matchtv',v_source_sha,v_kickoff_sha,v_source_at,v_kickoff_at)
  returning id into v_capture;

  insert into ff_private.ff_m4_time_proofs (
    capture_id,github_run_id,github_run_attempt,code_sha,
    source_match_id,home_provider_team_id,away_provider_team_id,source_oidc_jwt,
    kickoff_oidc_jwt,source_jwk,kickoff_jwk,source_token_sha256,
    kickoff_token_sha256,source_issued_at,kickoff_issued_at
  ) values (
    v_capture,900000,1,repeat('4',40),
    'match-synthetic','team-zenit','team-rubin',v_source,v_kickoff,
    '{"kid":"a","kty":"RSA"}'::jsonb,'{"kid":"b","kty":"RSA"}'::jsonb,
    v_source_sha,v_kickoff_sha,v_source_at,v_kickoff_at
  ) returning id into v_proof;
  if not exists (
    select 1 from ff_private.ff_m4_time_proofs p
    where p.id=v_proof and p.publication_allowed=false and
      p.holdout_2025_26_read=false and p.model_approved=false and
      p.committed_at > v_kickoff_at
  ) then
    raise exception 'M4 signed proof private server-clock invariants failed';
  end if;

  -- The schema only verifies hash/linkage; it does NOT claim the synthetic
  -- token has an actual GitHub signature.
  begin
    insert into ff_private.ff_m4_time_proofs (
      capture_id,github_run_id,github_run_attempt,code_sha,
      source_match_id,home_provider_team_id,away_provider_team_id,
      source_oidc_jwt,kickoff_oidc_jwt,source_jwk,kickoff_jwk,
      source_token_sha256,kickoff_token_sha256,source_issued_at,kickoff_issued_at
    ) values (
      v_capture,900001,1,repeat('4',40),
      'match-synthetic','team-zenit','team-rubin',v_source,v_kickoff,
      '{}'::jsonb,'{}'::jsonb,
      repeat('f',64),v_kickoff_sha,v_source_at,v_kickoff_at
    );
    raise exception 'Unexpected tampered proof accepted';
  exception when raise_exception then
    if sqlerrm <> 'M4 cryptographic receipt does not match source capture'
      then raise; end if;
  end;

  -- Swapping provider IDs with otherwise valid JWT digests must be rejected
  -- by the server-side capture-to-provider directed mapping check.
  begin
    insert into ff_private.ff_m4_time_proofs (
      capture_id,github_run_id,github_run_attempt,code_sha,
      source_match_id,home_provider_team_id,away_provider_team_id,
      source_oidc_jwt,kickoff_oidc_jwt,source_jwk,kickoff_jwk,
      source_token_sha256,kickoff_token_sha256,source_issued_at,kickoff_issued_at
    ) values (
      v_capture,900002,1,repeat('4',40),
      'match-synthetic','team-rubin','team-zenit',v_source,v_kickoff,
      '{"kid":"a","kty":"RSA"}'::jsonb,'{"kid":"b","kty":"RSA"}'::jsonb,
      v_source_sha,v_kickoff_sha,v_source_at,v_kickoff_at
    );
    raise exception 'Unexpected swapped provider IDs accepted';
  exception when raise_exception then
    if sqlerrm <> 'M4 cryptographic receipt does not match source capture'
      then raise; end if;
  end;

  begin
    update ff_private.ff_m4_time_proofs set github_run_id=999999
    where id=v_proof;
    raise exception 'Unexpected mutable proof';
  exception when others then
    if sqlerrm <> 'Source snapshot history is append-only' then raise; end if;
  end;
end;
$proof$;
rollback;
select 1 / case when
  (select count(*) from ff_private.ff_m4_time_proofs)=0 and
  (select count(*) from ff_private.ff_m4_future_captures)=0
then 1 else 0 end as synthetic_private_proofs_rolled_back;
\echo 'PASS: private M4 OIDC proof escrow linkage, RLS and immutability'
