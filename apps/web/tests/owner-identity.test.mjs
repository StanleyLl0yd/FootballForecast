import test from 'node:test';
import assert from 'node:assert/strict';
import { hasOwnerGitHubIdentity } from '../lib/owner-identity.ts';

const owner = '131160519';
const gh = (data) => [{ provider: 'github', identity_data: data }];

test('verified GitHub provider_id grants the matching numeric account', () => {
  assert.equal(hasOwnerGitHubIdentity(gh({provider_id: owner}), owner), true);
  assert.equal(hasOwnerGitHubIdentity(gh({provider_id: Number(owner)}), owner), true);
  assert.equal(hasOwnerGitHubIdentity(gh({sub: owner}), owner), true);
});

test('rejects absent or malformed configured owner', () => {
  for (const invalid of [undefined, '', '0', 'someone', ' 131160519', '131160519 ', '1e8', '-12']) {
    assert.equal(hasOwnerGitHubIdentity(gh({provider_id: owner}), invalid), false, String(invalid));
  }
});

test('rejects untrusted provider and non-owner identity', () => {
  assert.equal(hasOwnerGitHubIdentity([{provider:'google',identity_data:{sub:owner}}],owner),false);
  assert.equal(hasOwnerGitHubIdentity(gh({provider_id:'9999'}),owner),false);
  assert.equal(hasOwnerGitHubIdentity([
    {provider:'google',identity_data:{sub:owner}},
    {provider:'github',identity_data:{provider_id:'9999'}},
  ],owner),false);
  assert.equal(hasOwnerGitHubIdentity(undefined,owner),false);
  assert.equal(hasOwnerGitHubIdentity([],owner),false);
});

test('provider_id wins over a contradictory sub, failing closed', () => {
  assert.equal(hasOwnerGitHubIdentity(gh({provider_id:'9999',sub:owner}),owner),false);
  assert.equal(hasOwnerGitHubIdentity(gh({provider_id:owner,sub:'9999'}),owner),true);
});

test('rejects malformed provider data without string coercion', () => {
  for (const bad of [null, undefined, {}, [], true, 1.2, Number.POSITIVE_INFINITY, -1, '0', {}, {toString(){return owner;}}]) {
    assert.equal(hasOwnerGitHubIdentity(gh({provider_id:bad}),owner),false, String(bad));
  }
  assert.equal(hasOwnerGitHubIdentity(gh(null),owner),false);
  assert.equal(hasOwnerGitHubIdentity(gh({}),owner),false);
  assert.equal(hasOwnerGitHubIdentity([{provider:'github'}],owner),false);
});

test('does not accept a correct-looking user_metadata field', () => {
  assert.equal(hasOwnerGitHubIdentity([{provider:'github', identity_data:{user_metadata:{provider_id:owner}}}],owner),false);
});
