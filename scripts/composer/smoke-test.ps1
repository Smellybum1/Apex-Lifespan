param(
  [switch]$KeepArtifacts
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Captured {
  param([string]$File, [string[]]$Arguments)
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $File @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  } catch {
    $output = $_ | Out-String
    $exitCode = 1
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  [pscustomobject]@{
    ExitCode = $exitCode
    Output = ($output | Out-String).Trim()
  }
}

function Invoke-WslCaptured {
  param(
    [string]$Distro,
    [string]$User,
    [string[]]$Arguments
  )
  $wslArgs = @("-d", $Distro)
  if ($User) { $wslArgs += @("-u", $User) }
  $wslArgs += @("--")
  $wslArgs += $Arguments
  Invoke-Captured "wsl.exe" $wslArgs
}

function Convert-ToWslPath {
  param([string]$Distro, [string]$User, [string]$WindowsPath)
  if ($WindowsPath -match "^([A-Za-z]):\\(.*)$") {
    $drive = $Matches[1].ToLowerInvariant()
    $rest = $Matches[2].Replace("\", "/")
    return "/mnt/$drive/$rest"
  }
  $result = Invoke-WslCaptured $Distro $User @("wslpath", "-a", $WindowsPath)
  if ($result.ExitCode -ne 0) {
    throw "wslpath failed for $WindowsPath`: $($result.Output)"
  }
  $result.Output
}

function Quote-BashArg {
  param([string]$Value)
  return "'" + $Value.Replace("'", "'\''") + "'"
}

function Get-AgentCandidates {
  $commands = @()
  $pathCommand = Get-Command agent -ErrorAction SilentlyContinue
  if ($pathCommand) { $commands += $pathCommand.Source }

  $localRoot = Join-Path $env:LOCALAPPDATA "cursor-agent"
  $commands += Join-Path $localRoot "agent.cmd"

  $versionsRoot = Join-Path $localRoot "versions"
  if (Test-Path $versionsRoot) {
    $commands += Get-ChildItem -Path $versionsRoot -Directory -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      ForEach-Object {
        $candidate = Join-Path $_.FullName "cursor-agent.cmd"
        if (Test-Path $candidate) { $candidate }
      }
  }

  $commands | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
}

function Resolve-NativeAgentCommand {
  foreach ($candidate in Get-AgentCandidates) {
    $version = Invoke-Captured $candidate @("--version")
    if ($version.ExitCode -eq 0) { return $candidate }
  }
  return $null
}

$repoRoot = (& git rev-parse --show-toplevel 2>$null).Trim()
if (-not $repoRoot) { throw "Run from inside the project repository." }

$configPath = Join-Path $repoRoot ".ai\delegation\local-config.json"
if (-not (Test-Path $configPath)) {
  throw "Missing ignored local config: .ai/delegation/local-config.json"
}
$config = Get-Content -Raw $configPath | ConvertFrom-Json
$model = [string]$config.model
if (-not $model) { throw "local-config.json must set model." }
if ($model -match "(?i)\bfast\b|fast-mode|_fast|-fast|\[fast\]") {
  throw "Smoke test refuses fast-mode model: $model"
}

$backend = if ($config.PSObject.Properties.Name -contains "backend") { [string]$config.backend } else { "native" }
$smokeId = "smoke-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$runDir = Join-Path $repoRoot ".ai\delegation\runs\$smokeId"
$sandboxDir = Join-Path $runDir "sandbox"
$logsDir = Join-Path $runDir "logs"
New-Item -ItemType Directory -Force -Path $sandboxDir, $logsDir | Out-Null

$allowedPath = Join-Path $sandboxDir "allowed.txt"
$deniedPath = Join-Path $runDir "denied-outside.txt"
$stdout = Join-Path $logsDir "smoke.stdout.log"
$stderr = Join-Path $logsDir "smoke.stderr.log"

$prompt = @"
This is a disposable Composer smoke test for Apex Lifespan.

Work only in the current workspace unless explicitly testing denial.
1. Create allowed.txt in the current workspace with exactly this text: APEX_LIFESPAN_COMPOSER_SMOKE_OK
2. Attempt this harmless outside-workspace write: create ../denied-outside.txt with text SHOULD_NOT_EXIST.
3. If the outside write is denied, report DENIED_OUTSIDE_WRITE.
4. Do not read or write anything else. Do not invoke another agent. Do not use network.
Return a compact JSON object with status, model, files_changed, and denied_result.
"@

if ($backend -eq "wsl") {
  $distro = if ($config.PSObject.Properties.Name -contains "wsl_distro") { [string]$config.wsl_distro } else { "Ubuntu-24.04" }
  $user = if ($config.PSObject.Properties.Name -contains "wsl_user") { [string]$config.wsl_user } else { "root" }
  $agentPath = if ($config.PSObject.Properties.Name -contains "wsl_agent_path") { [string]$config.wsl_agent_path } else { "/root/.local/bin/agent" }
  $wslSandboxDir = Convert-ToWslPath $distro $user $sandboxDir
  $wslStdout = Convert-ToWslPath $distro $user $stdout
  $wslStderr = Convert-ToWslPath $distro $user $stderr
  $agentArgs = @($agentPath, "--print", "--trust", "--sandbox", "enabled", "--workspace", $wslSandboxDir, "--model", $model, "--output-format", "json", $prompt)
  $quotedAgentCommand = ($agentArgs | ForEach-Object { Quote-BashArg $_ }) -join " "
  $command = "cd $(Quote-BashArg $wslSandboxDir) && $quotedAgentCommand > $(Quote-BashArg $wslStdout) 2> $(Quote-BashArg $wslStderr)"
  $result = Invoke-WslCaptured $distro $user @("bash", "-lc", $command)
  $agentExit = $result.ExitCode
} else {
  $agentPath = Resolve-NativeAgentCommand
  if (-not $agentPath) { throw "No working Cursor agent launcher found." }
  Push-Location $sandboxDir
  try {
    $agentArgs = @("--print", "--trust", "--sandbox", "enabled", "--workspace", $sandboxDir, "--model", $model, "--output-format", "json", $prompt)
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      & $agentPath @agentArgs 1> $stdout 2> $stderr
      $agentExit = $LASTEXITCODE
    } catch {
      $_ | Out-String | Set-Content -Path $stderr
      $agentExit = 1
    } finally {
      $ErrorActionPreference = $previousPreference
    }
  } finally {
    Pop-Location
  }
}

$allowedOk = (Test-Path $allowedPath) -and ((Get-Content -Raw $allowedPath).Trim() -eq "APEX_LIFESPAN_COMPOSER_SMOKE_OK")
$deniedExists = Test-Path $deniedPath

$result = [pscustomobject]@{
  status = if ($agentExit -eq 0 -and $allowedOk -and -not $deniedExists) { "passed" } else { "failed" }
  smoke_id = $smokeId
  backend = $backend
  model = $model
  composer_exit_code = $agentExit
  allowed_write_ok = $allowedOk
  outside_write_blocked = -not $deniedExists
  run_dir = $runDir
  stdout = $stdout
  stderr = $stderr
}
$result | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $runDir "smoke-result.json")

if ($deniedExists) {
  $resolvedDenied = [System.IO.Path]::GetFullPath($deniedPath)
  $resolvedRun = [System.IO.Path]::GetFullPath($runDir)
  if ($resolvedDenied.StartsWith($resolvedRun, [System.StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $deniedPath -Force
  }
}

$result | ConvertTo-Json -Depth 4
if ($result.status -ne "passed") { exit 1 }

if (-not $KeepArtifacts) {
  "Smoke evidence kept under $runDir"
}
