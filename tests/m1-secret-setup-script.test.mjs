import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const script=readFileSync(new URL('../scripts/Set-M1PrivateImportSecrets.ps1',import.meta.url),'utf8');

test('M1 setup cannot write repository-wide secrets or bypass branch restrictions',()=>{
  assert.match(script,/\$EnvironmentName = 'm1-source-import'/);
  assert.match(script,/custom_branch_policies = \$true/);
  assert.match(script,/protected_branches = \$false/);
  assert.match(script,/\$existingPolicies\.Count -ne 1/);
  assert.match(script,/\$existingPolicies\[0\]\.name -ne 'main'/);
  assert.match(script,/\$branch\.protected -ne \$true/);
  assert.match(script,/--env \$EnvironmentName/);
  assert.doesNotMatch(script,/\bgh secret set\b/);
  assert.doesNotMatch(script,/\bgh workflow run\b/);
});

test('M1 setup passes secret value only through ephemeral child stdin',()=>{
  assert.match(script,/RedirectStandardInput = \$true/);
  assert.match(script,/\.StandardInput\.Write\(\$Value\)/);
  assert.match(script,/\.StandardInput\.Close\(\)/);
  assert.match(script,/Read-Host 'Database password \(masked\)' -AsSecureString/);
  assert.match(script,/\.ArgumentList\.Add\(\$arg\)/);
  assert.match(script,/secret', 'set', \$Name, '-R', \$Repository, '-e', \$EnvironmentName/);
  assert.doesNotMatch(script,/Set-Content|Out-File|Add-Content|Tee-Object/);
  assert.doesNotMatch(script,/Write-(?:Host|Output)\s+.*(?:\$clearPassword|\$Value)/);
  assert.doesNotMatch(script,/--body|--env-file|--no-store/);
});

test('exactly one optional, bounded PEM is accepted and verification checks names only',()=>{
  assert.match(script,/12000/);
  assert.match(script,/BEGIN CERTIFICATE/);
  assert.match(script,/ToBase64String\(\$certBytes\)/);
  assert.match(script,/gh secret list --repo \$Repository --env \$EnvironmentName --json name/);
  assert.match(script,/Their values were never printed/);
});
