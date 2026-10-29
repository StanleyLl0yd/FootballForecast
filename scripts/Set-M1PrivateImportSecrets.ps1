#requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Repository = 'StanleyLl0yd/FootballForecast'
$EnvironmentName = 'm1-source-import'

function Invoke-GitHubApi {
    param(
        [Parameter(Mandatory)][string]$Endpoint,
        [ValidateSet('GET', 'PUT', 'POST')][string]$Method = 'GET',
        [object]$Payload = $null
    )

    if ($null -eq $Payload) {
        $result = & gh api --method $Method $Endpoint
    }
    else {
        $json = ConvertTo-Json -InputObject $Payload -Depth 8 -Compress
        $result = $json | & gh api --method $Method --input - $Endpoint
    }
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub API request failed: $Method $Endpoint"
    }
    return ($result | ConvertFrom-Json)
}

function Set-EnvironmentSecret {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Value
    )

    if ($Value.Length -eq 0) {
        throw "Empty secret value: $Name"
    }
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = (Get-Command gh -ErrorAction Stop).Source
    $start.UseShellExecute = $false
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.CreateNoWindow = $true
    foreach ($arg in @('secret', 'set', $Name, '-R', $Repository, '-e', $EnvironmentName)) {
        [void]$start.ArgumentList.Add($arg)
    }

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $start
    try {
        if (-not $process.Start()) {
            throw "Failed to start GitHub CLI for $Name"
        }
        $process.StandardInput.Write($Value)
        $process.StandardInput.Close()
        [void]$process.StandardOutput.ReadToEnd()
        [void]$process.StandardError.ReadToEnd()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) {
            throw "GitHub refused to store environment secret $Name (exit $($process.ExitCode))"
        }
    }
    finally {
        $process.Dispose()
    }
    Write-Host "[OK] $Name stored in protected GitHub Environment"
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI (gh) must be installed first.'
}
& gh auth status --hostname github.com *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Log in with gh auth login first.'
}

$branch = Invoke-GitHubApi -Endpoint "repos/$Repository/branches/main"
if ($branch.name -ne 'main' -or $branch.protected -ne $true) {
    throw 'The repository main branch must be protected before adding import secrets.'
}

$allEnvironments = Invoke-GitHubApi -Endpoint "repos/$Repository/environments"
$exists = @($allEnvironments.environments | Where-Object { $_.name -eq $EnvironmentName }).Count -gt 0
if (-not $exists) {
    [void](Invoke-GitHubApi -Endpoint "repos/$Repository/environments/$EnvironmentName" -Method PUT -Payload @{
        wait_timer = 0
        deployment_branch_policy = @{
            protected_branches = $false
            custom_branch_policies = $true
        }
    })
    Write-Host '[OK] Created GitHub Environment with custom deployment branch restrictions'
}

$environment = Invoke-GitHubApi -Endpoint "repos/$Repository/environments/$EnvironmentName"
if ($environment.deployment_branch_policy.custom_branch_policies -ne $true) {
    throw 'Environment does not enforce custom branch policies; update it to selected branches before storing secrets.'
}

$policyEndpoint = "repos/$Repository/environments/$EnvironmentName/deployment-branch-policies"
$policies = Invoke-GitHubApi -Endpoint $policyEndpoint
$existingPolicies = @($policies.branch_policies)
$mainPolicy = @($existingPolicies | Where-Object { $_.type -eq 'branch' -and $_.name -eq 'main' })
if ($mainPolicy.Count -eq 0) {
    [void](Invoke-GitHubApi -Endpoint $policyEndpoint -Method POST -Payload @{
        name = 'main'
        type = 'branch'
    })
}
$policies = Invoke-GitHubApi -Endpoint $policyEndpoint
$existingPolicies = @($policies.branch_policies)
if ($existingPolicies.Count -ne 1 -or
    $existingPolicies[0].name -ne 'main' -or
    $existingPolicies[0].type -ne 'branch') {
    throw 'Import environment must permit exactly one branch policy: main.'
}
Write-Host '[VERIFIED] Environment deploy restriction: main only'

$hostName = (Read-Host 'Supabase Session pooler hostname (no protocol or port)').Trim()
if ($hostName.Length -gt 253 -or $hostName -notmatch '^[A-Za-z0-9][A-Za-z0-9.-]+$') {
    throw 'Invalid PostgreSQL hostname.'
}

$userName = (Read-Host 'Supabase Session pooler username').Trim()
if ($userName -notmatch '^[A-Za-z0-9_.-]{3,128}$') {
    throw 'Invalid PostgreSQL username.'
}

$dbName = (Read-Host 'Database name [postgres]').Trim()
if ($dbName.Length -eq 0) { $dbName = 'postgres' }
if ($dbName -notmatch '^[A-Za-z_][A-Za-z0-9_]{0,62}$') {
    throw 'Invalid PostgreSQL database name.'
}

$password = Read-Host 'Database password (masked)' -AsSecureString
if ($password.Length -eq 0) {
    throw 'Empty password refused.'
}
$certificatePath = (Read-Host 'Optional path to Supabase database root CA PEM (Enter = system trust)').Trim()

Set-EnvironmentSecret -Name 'M1_PGHOST' -Value $hostName
Set-EnvironmentSecret -Name 'M1_PGUSER' -Value $userName
Set-EnvironmentSecret -Name 'M1_PGDATABASE' -Value $dbName
$clearPassword = [System.Net.NetworkCredential]::new('', $password).Password
try {
    Set-EnvironmentSecret -Name 'M1_PGPASSWORD' -Value $clearPassword
}
finally {
    $clearPassword = $null
    $password.Dispose()
}
if ($certificatePath.Length -gt 0) {
    $cert = (Resolve-Path -LiteralPath $certificatePath -ErrorAction Stop).Path
    $certBytes = [System.IO.File]::ReadAllBytes($cert)
    if ($certBytes.Length -lt 100 -or $certBytes.Length -gt 12000 -or
        -not [System.Text.Encoding]::ASCII.GetString($certBytes).Contains('BEGIN CERTIFICATE')) {
        throw 'Invalid root CA PEM file.'
    }
    Set-EnvironmentSecret -Name 'M1_PGROOTCERT_B64' -Value ([Convert]::ToBase64String($certBytes))
}

$secretListJson = & gh secret list --repo $Repository --env $EnvironmentName --json name
if ($LASTEXITCODE -ne 0) {
    throw 'Cannot verify environment secret names.'
}
$names = @($secretListJson | ConvertFrom-Json | ForEach-Object { $_.name })
foreach ($required in @('M1_PGHOST', 'M1_PGUSER', 'M1_PGDATABASE', 'M1_PGPASSWORD')) {
    if ($required -notin $names) {
        throw "Required environment secret name is missing: $required"
    }
}
Write-Host '[VERIFIED] Four required secrets exist. Their values were never printed.'
Write-Host 'NEXT: manually dispatch m1-private-stage-import.yml on main with confirmation STAGE_FOOTBOLNO_PRIVATE.'
