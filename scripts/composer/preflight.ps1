param(
  [switch]$Json
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
    [string]$AgentPath,
    [string[]]$Arguments
  )
  $wslArgs = @("-d", $Distro)
  if ($User) { $wslArgs += @("-u", $User) }
  $wslArgs += @("--", $AgentPath)
  $wslArgs += $Arguments
  Invoke-Captured "wsl.exe" $wslArgs
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
    if ($version.ExitCode -eq 0) {
      return [pscustomobject]@{
        Path = $candidate
        Version = $version.Output
      }
    }
  }
  return $null
}

function Write-Result {
  param([hashtable]$Result)
  if ($Json) {
    $Result | ConvertTo-Json -Depth 5
  } else {
    "STATUS: $($Result.status)"
    if ($Result.ContainsKey("backend")) { "backend: $($Result.backend)" }
    if ($Result.ContainsKey("agent_path")) { "agent: $($Result.agent_path)" }
    if ($Result.ContainsKey("version")) { "version: $($Result.version)" }
    if ($Result.ContainsKey("model")) { "model: $($Result.model)" }
    if ($Result.ContainsKey("message")) { $Result.message }
    if ($Result.ContainsKey("next_action")) { "next: $($Result.next_action)" }
  }
}

function Test-CommonPreflight {
  param(
    [hashtable]$ResultBase,
    [object]$Config,
    [object]$Version,
    [object]$Help,
    [object]$Status,
    [object]$Models,
    [string]$Backend,
    [string]$AgentPath
  )

  if ($Status.ExitCode -ne 0 -or $Status.Output -match "(login required|not\s+logged\s+in|unauth|not signed|sign in)") {
    Write-Result ($ResultBase + @{
      status = "ready-after-login"
      version = $Version.Output
      message = "Cursor CLI is installed but authentication is not ready."
      next_action = "Run Cursor Agent login in the $Backend environment, then rerun npm run composer:preflight."
    })
    exit 2
  }

  $requiredFlags = @("--print", "--model", "--sandbox", "--trust", "--output-format")
  $missingFlags = @()
  foreach ($flag in $requiredFlags) {
    if ($Help.Output -notmatch [regex]::Escape($flag)) {
      $missingFlags += $flag
    }
  }
  if ($Help.Output -notmatch "stream-json") {
    $missingFlags += "stream-json output"
  }
  if ($missingFlags.Count -gt 0) {
    Write-Result ($ResultBase + @{
      status = "blocked"
      version = $Version.Output
      message = "Cursor CLI help does not advertise required headless safety flags: $($missingFlags -join ', ')."
      next_action = "Update Cursor CLI or keep Composer delegation disabled."
    })
    exit 2
  }

  $configuredModel = $null
  $safetyProven = $false
  $forbidFastMode = $true
  $sandboxMode = "enabled"
  if ($Config.PSObject.Properties.Name -contains "model") { $configuredModel = [string]$Config.model }
  if ($Config.PSObject.Properties.Name -contains "safety_proven") { $safetyProven = [bool]$Config.safety_proven }
  if ($Config.PSObject.Properties.Name -contains "forbid_fast_mode") { $forbidFastMode = [bool]$Config.forbid_fast_mode }
  if ($Config.PSObject.Properties.Name -contains "sandbox") { $sandboxMode = [string]$Config.sandbox }

  $composerLines = @($Models.Output -split "\r?\n" | Where-Object { $_ -match "^\s*composer-2\.5\s+-\s+Composer\s+2\.5\s*$" })
  if (-not $configuredModel -and $composerLines.Count -eq 1) {
    $configuredModel = "composer-2.5"
  }

  if (-not $configuredModel) {
    Write-Result ($ResultBase + @{
      status = "blocked"
      version = $Version.Output
      message = "Could not resolve the exact Composer 2.5 model identifier from 'agent models'."
      next_action = "Set .ai/delegation/local-config.json model to composer-2.5."
    })
    exit 2
  }

  if ($forbidFastMode -and $configuredModel -match "(?i)\bfast\b|fast-mode|_fast|-fast|\[fast\]") {
    Write-Result ($ResultBase + @{
      status = "blocked"
      version = $Version.Output
      model = $configuredModel
      message = "Configured Composer model appears to be fast mode. This project requires Composer 2.5 standard mode."
      next_action = "Set .ai/delegation/local-config.json model to composer-2.5."
    })
    exit 2
  }

  if ($Backend -eq "native" -and $sandboxMode -eq "enabled" -and [System.Environment]::OSVersion.Platform -eq "Win32NT") {
    Write-Result ($ResultBase + @{
      status = "blocked"
      version = $Version.Output
      model = $configuredModel
      message = "Cursor Agent sandbox mode is not available in native Windows; Cursor reports sandbox requires macOS or Linux."
      next_action = "Use backend=wsl with Ubuntu-24.04, Linux, or macOS for autonomous Composer delegation."
    })
    exit 2
  }

  if (-not $safetyProven) {
    Write-Result ($ResultBase + @{
      status = "blocked"
      version = $Version.Output
      model = $configuredModel
      message = "Cursor is installed and authenticated, but autonomous safety has not been marked proven in ignored local config."
      next_action = "Run npm run composer:smoke, then set safety_proven true only if it passes."
    })
    exit 2
  }

  Write-Result ($ResultBase + @{
    status = "ready"
    version = $Version.Output
    model = $configuredModel
    message = "Cursor Composer delegation preflight passed."
  })
}

$repoRoot = (& git rev-parse --show-toplevel 2>$null).Trim()
if (-not $repoRoot) {
  Write-Result @{ status = "blocked"; message = "Not inside a Git repository."; next_action = "Run from the project repository root." }
  exit 2
}

$configPath = Join-Path $repoRoot ".ai\delegation\local-config.json"
if (-not (Test-Path $configPath)) {
  Write-Result @{ status = "blocked"; message = "Missing ignored local config: .ai/delegation/local-config.json"; next_action = "Copy local-config.example.json and set model/backend." }
  exit 2
}
$config = Get-Content -Raw $configPath | ConvertFrom-Json
$backend = if ($config.PSObject.Properties.Name -contains "backend") { [string]$config.backend } else { "native" }

if ($backend -eq "wsl") {
  $distro = if ($config.PSObject.Properties.Name -contains "wsl_distro") { [string]$config.wsl_distro } else { "Ubuntu-24.04" }
  $user = if ($config.PSObject.Properties.Name -contains "wsl_user") { [string]$config.wsl_user } else { "root" }
  $agentPath = if ($config.PSObject.Properties.Name -contains "wsl_agent_path") { [string]$config.wsl_agent_path } else { "/root/.local/bin/agent" }
  $base = @{ backend = "wsl"; agent_path = "wsl:${distro}:$agentPath" }
  $version = Invoke-WslCaptured $distro $user $agentPath @("--version")
  if ($version.ExitCode -ne 0) {
    Write-Result ($base + @{ status = "ready-after-install"; message = "Could not run Cursor Agent in WSL."; next_action = "Install Cursor CLI inside $distro and log in there." })
    exit 2
  }
  $timeoutProbe = Invoke-WslCaptured $distro $user "timeout" @("--version")
  if ($timeoutProbe.ExitCode -ne 0) {
    Write-Result ($base + @{ status = "blocked"; version = $version.Output; message = "WSL is missing GNU timeout, which is required to bound headless Composer runs."; next_action = "Install coreutils in $distro or use a WSL image with timeout available." })
    exit 2
  }
  $help = Invoke-WslCaptured $distro $user $agentPath @("--help")
  $status = Invoke-WslCaptured $distro $user $agentPath @("status")
  $models = Invoke-WslCaptured $distro $user $agentPath @("models")
  Test-CommonPreflight $base $config $version $help $status $models "wsl" $agentPath
  exit 0
}

$agentCommand = Resolve-NativeAgentCommand
if (-not $agentCommand) {
  Write-Result @{
    status = "ready-after-install"
    backend = "native"
    message = "Cursor CLI command 'agent' is not available or no working Cursor agent launcher was found."
    next_action = "Install Cursor CLI from the official Cursor CLI docs, then run 'agent login' and rerun npm run composer:preflight."
  }
  exit 2
}

$agentPath = $agentCommand.Path
$version = [pscustomobject]@{ ExitCode = 0; Output = $agentCommand.Version }
$help = Invoke-Captured $agentPath @("--help")
$status = Invoke-Captured $agentPath @("status")
$models = Invoke-Captured $agentPath @("models")
$base = @{ backend = "native"; agent_path = $agentPath }
Test-CommonPreflight $base $config $version $help $status $models "native" $agentPath
