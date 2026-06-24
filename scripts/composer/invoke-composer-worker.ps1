param(
  [Parameter(Mandatory = $true)]
  [string]$TaskJson,
  [switch]$AllowDirtyMain,
  [switch]$UseDirtyMainSnapshot,
  [switch]$CleanExistingWorktree,
  [int]$AgentTimeoutSeconds = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-JsonFile {
  param([string]$Path)
  Get-Content -Raw $Path | ConvertFrom-Json
}

function Match-TaskPath {
  param([string]$PathValue, [string[]]$Patterns)
  $normalized = $PathValue.Replace("\", "/")
  foreach ($pattern in $Patterns) {
    $p = $pattern.Replace("\", "/")
    $regex = "^" + [regex]::Escape($p).Replace("\*\*", ".*").Replace("\*", "[^/]*") + "$"
    if ($normalized -match $regex) { return $true }
  }
  return $false
}

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

function Convert-ToCmdCheckCommand {
  param([string]$Command)
  $trimmed = $Command.Trim()
  if ($trimmed -match '^\s*["'']') { return $Command }
  if ($trimmed -match '^(?<program>(?:\.{1,2}[\\/]|[A-Za-z]:[\\/]|[^&|<>\r\n]*[\\/])?[^&|<>\r\n]*?\.(?:cmd|bat|exe))(?<arguments>\s.*)?$') {
    $program = $Matches["program"].Trim()
    $arguments = ""
    if ($Matches.ContainsKey("arguments")) { $arguments = $Matches["arguments"] }
    if ($program -match "\s") {
      return '"' + $program + '"' + $arguments
    }
  }
  return $Command
}

function Get-ShortHash {
  param([string]$Value)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    $hashBytes = $sha.ComputeHash($bytes)
    return ([System.BitConverter]::ToString($hashBytes).Replace("-", "").Substring(0, 12)).ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function New-CheckLogPath {
  param([string]$LogsDir, [int]$Index, [string]$Command)
  $safeName = ($Command -replace "[^A-Za-z0-9_.-]", "_").Trim("_")
  $safeName = $safeName -replace "_{2,}", "_"
  if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = "check" }

  $hash = Get-ShortHash $Command
  $compactName = "check-{0:D2}-{1}.log" -f $Index, $hash
  $logsDirFull = [System.IO.Path]::GetFullPath($LogsDir)
  $availableNameLength = 240 - ($logsDirFull.Length + 1)
  if ($availableNameLength -le ($compactName.Length + 8)) {
    return Join-Path $LogsDir $compactName
  }

  $prefix = "check-{0:D2}-" -f $Index
  $suffix = "-$hash.log"
  $targetNameLength = [Math]::Min(120, $availableNameLength)
  $maxSlugLength = $targetNameLength - $prefix.Length - $suffix.Length
  if ($maxSlugLength -lt 8) { return Join-Path $LogsDir $compactName }
  if ($safeName.Length -gt $maxSlugLength) {
    $safeName = $safeName.Substring(0, $maxSlugLength).Trim("_", ".", "-")
  }
  if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = "check" }
  Join-Path $LogsDir ($prefix + $safeName + $suffix)
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

function New-WorktreeDirectoryLink {
  param([string]$Path, [string]$Target)
  if ((Test-Path $Target) -and -not (Test-Path $Path)) {
    $parent = Split-Path -Parent $Path
    if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    if ([System.Environment]::OSVersion.Platform -eq "Win32NT") {
      New-Item -ItemType Junction -Path $Path -Target $Target | Out-Null
    } else {
      New-Item -ItemType SymbolicLink -Path $Path -Target $Target | Out-Null
    }
  }
}

function Remove-WorktreeDirectoryLink {
  param([string]$Path)
  $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
  if (-not $item) { return }
  if (-not (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq [System.IO.FileAttributes]::ReparsePoint)) {
    return
  }
  [System.IO.Directory]::Delete($item.FullName)
}

function Assert-ComposerWorktreePath {
  param([string]$RepoRoot, [string]$WorktreePath, [string]$WorktreeRoot)
  $worktreeFull = [System.IO.Path]::GetFullPath($WorktreePath)
  $rootFull = [System.IO.Path]::GetFullPath($WorktreeRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
  if (-not $worktreeFull.StartsWith($rootFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clean worktree outside Composer worktree root: $worktreeFull"
  }
  $registeredWorktrees = @(& git -C $RepoRoot worktree list --porcelain | Where-Object { $_ -like "worktree *" } | ForEach-Object { $_.Substring("worktree ".Length) })
  $isRegistered = $false
  foreach ($registered in $registeredWorktrees) {
    $registeredFull = [System.IO.Path]::GetFullPath($registered)
    if ([string]::Equals($registeredFull, $worktreeFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      $isRegistered = $true
      break
    }
  }
  if (-not $isRegistered) {
    throw "Refusing to clean unregistered Composer worktree path: $worktreeFull"
  }
  return $worktreeFull
}

function Quote-BashArg {
  param([string]$Value)
  return "'" + $Value.Replace("'", "'\''") + "'"
}

function Test-DirtySnapshotSkip {
  param([string]$PathValue)
  $normalized = $PathValue.Replace("\", "/")
  if ($normalized -eq ".ai/delegation/local-config.json") { return $true }
  if ($normalized -like ".ai/delegation/runs/*") { return $true }
  if ($normalized -like ".git/*") { return $true }
  if (Test-GeneratedArtifactPath $normalized) { return $true }
  if ($normalized -like ".env*") { return $true }
  return $false
}

function Test-GeneratedArtifactPath {
  param([string]$PathValue)
  $normalized = $PathValue.Replace("\", "/").Trim("/")
  $roots = @(
    ".cache",
    ".next",
    ".tools",
    ".venv",
    "build",
    "cache",
    "coverage",
    "data",
    "dist",
    "logs",
    "node_modules",
    "out",
    "playwright-report",
    "test-results"
  )
  foreach ($root in $roots) {
    if ($normalized -eq $root -or $normalized -like "$root/*") { return $true }
  }
  return $false
}

function Remove-DisposableGeneratedArtifacts {
  param([string]$WorktreePath)
  $worktreeFull = [System.IO.Path]::GetFullPath($WorktreePath)
  $artifactRoots = @(".next", "out", "dist", "build", "coverage", "logs", ".cache", "cache", "playwright-report", "test-results")
  foreach ($root in $artifactRoots) {
    $target = [System.IO.Path]::GetFullPath((Join-Path $worktreeFull $root))
    if (-not $target.StartsWith($worktreeFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to remove generated artifact outside worktree: $target"
    }
    $item = Get-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
    if (-not $item) { continue }
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq [System.IO.FileAttributes]::ReparsePoint) {
      if ($item.PSIsContainer) {
        [System.IO.Directory]::Delete($item.FullName)
      } else {
        [System.IO.File]::Delete($item.FullName)
      }
    } elseif ($item.PSIsContainer) {
      Remove-Item -LiteralPath $item.FullName -Recurse -Force
    } else {
      Remove-Item -LiteralPath $item.FullName -Force
    }
  }
}

function Get-AddedDiffLines {
  param([string]$WorktreePath, [string]$PathValue)
  @(& git -C $WorktreePath diff --unified=0 -- $PathValue | Where-Object {
    $_ -like "+*" -and $_ -notlike "+++ *"
  } | ForEach-Object {
    $_.Substring(1)
  })
}

function Copy-DirtyMainSnapshot {
  param(
    [string]$RepoRoot,
    [string]$WorktreePath,
    [string[]]$DirtyFiles,
    [string]$RunDir
  )
  $copied = @()
  $skipped = @()
  foreach ($file in $DirtyFiles) {
    $normalized = $file.Replace("\", "/")
    if (Test-DirtySnapshotSkip $normalized) {
      $skipped += $normalized
      continue
    }
    $source = Join-Path $RepoRoot $normalized
    $destination = Join-Path $WorktreePath $normalized
    if (Test-Path -LiteralPath $source -PathType Leaf) {
      $parent = Split-Path -Parent $destination
      if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
      Copy-Item -LiteralPath $source -Destination $destination -Force
      $copied += $normalized
    } elseif (-not (Test-Path -LiteralPath $source) -and (Test-Path -LiteralPath $destination)) {
      Remove-Item -LiteralPath $destination -Force
      $copied += $normalized
    } else {
      $skipped += $normalized
    }
  }
  $copied | Set-Content -Path (Join-Path $RunDir "dirty-snapshot-copied-files.txt")
  $skipped | Set-Content -Path (Join-Path $RunDir "dirty-snapshot-skipped-files.txt")

  if ($copied.Count -gt 0) {
    & git -C $WorktreePath add -A -- . ":(exclude).composer-task"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & git -C $WorktreePath diff --cached --name-only | Set-Content -Path (Join-Path $RunDir "dirty-snapshot-baseline-files.txt")
  }
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

function Resolve-AgentCommand {
  foreach ($candidate in Get-AgentCandidates) {
    $version = Invoke-Captured $candidate @("--version")
    if ($version.ExitCode -eq 0) { return $candidate }
  }
  return $null
}

$repoRoot = (& git rev-parse --show-toplevel 2>$null).Trim()
if (-not $repoRoot) { throw "Run from inside the project repository." }

Write-Host "[composer:invoke] validate task"
$taskPath = Resolve-Path $TaskJson
& node (Join-Path $repoRoot "scripts\composer\validate-task.cjs") $taskPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[composer:invoke] preflight"
$preflight = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\composer\preflight.ps1") -Json | Out-String
$preflightJson = $preflight | ConvertFrom-Json
if ($preflightJson.status -ne "ready") {
  $preflight.Trim()
  exit 2
}

Write-Host "[composer:invoke] read task"
$task = Read-JsonFile $taskPath
$taskId = [string]$task.task_id
$runDir = Join-Path $repoRoot ".ai\delegation\runs\$taskId"
$logsDir = Join-Path $runDir "logs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

$staleRunArtifacts = @(
  "agent-timeout.txt",
  "changed-files.txt",
  "checks-summary.md",
  "diff-stat.txt",
  "dirty-snapshot-baseline-files.txt",
  "dirty-snapshot-copied-files.txt",
  "dirty-snapshot-skipped-files.txt",
  "existing-worktree-path.txt",
  "implementation.patch",
  "main-dirty-files.txt",
  "review-summary.md",
  "review.json"
)
foreach ($artifact in $staleRunArtifacts) {
  Remove-Item -LiteralPath (Join-Path $runDir $artifact) -Force -ErrorAction SilentlyContinue
}
Get-ChildItem -LiteralPath $logsDir -File -ErrorAction SilentlyContinue |
  Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "[composer:invoke] check dirty state"
$dirtyOutput = @()
$dirtyOutput += & git -C $repoRoot diff --name-only
$dirtyOutput += & git -C $repoRoot diff --cached --name-only
$dirtyOutput += & git -C $repoRoot ls-files --others --exclude-standard
$dirtyFiles = @($dirtyOutput | Where-Object { $_ })

if ($dirtyFiles.Count -gt 0 -and -not $AllowDirtyMain -and -not $UseDirtyMainSnapshot) {
  $dirtyFiles | Set-Content -Path (Join-Path $runDir "main-dirty-files.txt")
  Write-Error "Main workspace is dirty. Review .ai/delegation/runs/$taskId/main-dirty-files.txt, rerun with -AllowDirtyMain if the task does not need dirty context, or rerun with -UseDirtyMainSnapshot to stage a disposable dirty baseline in the Composer worktree."
  exit 2
}

$configPath = Join-Path $repoRoot ".ai\delegation\local-config.json"
$config = Read-JsonFile $configPath
$backend = if ($config.PSObject.Properties.Name -contains "backend") { [string]$config.backend } else { "native" }
$configuredAgentTimeoutSeconds = if ($config.PSObject.Properties.Name -contains "agent_timeout_seconds") { [int]$config.agent_timeout_seconds } else { 210 }
$agentTimeoutSeconds = if ($AgentTimeoutSeconds -gt 0) { $AgentTimeoutSeconds } else { $configuredAgentTimeoutSeconds }
if ($agentTimeoutSeconds -lt 30) {
  throw "agent_timeout_seconds must be at least 30 seconds."
}
$agentOutputFormat = if ($config.PSObject.Properties.Name -contains "agent_output_format") { [string]$config.agent_output_format } else { "stream-json" }
if ($agentOutputFormat -notin @("json", "stream-json")) {
  throw "agent_output_format must be json or stream-json."
}
$worktreeRootSetting = if ($config.PSObject.Properties.Name -contains "worktree_root") { [string]$config.worktree_root } else { "../.apex-lifespan-composer-worktrees" }
$worktreeRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $worktreeRootSetting))
$worktreePath = Join-Path $worktreeRoot $taskId

if (Test-Path $worktreePath) {
  $worktreePath | Set-Content -Path (Join-Path $runDir "existing-worktree-path.txt")
  if (-not $CleanExistingWorktree) {
    throw "Worktree path already exists: $worktreePath. Review existing run artifacts, then rerun with -CleanExistingWorktree to remove the disposable registered worktree."
  }
  $cleanPath = Assert-ComposerWorktreePath $repoRoot $worktreePath $worktreeRoot
  & git -C $repoRoot worktree remove --force $cleanPath | Tee-Object -FilePath (Join-Path $logsDir "git-worktree-clean.log")
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

New-Item -ItemType Directory -Force -Path $worktreeRoot | Out-Null
& git -C $repoRoot worktree add --detach $worktreePath HEAD | Tee-Object -FilePath (Join-Path $logsDir "git-worktree.log")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$mainNodeModules = Join-Path $repoRoot "node_modules"
$worktreeNodeModules = Join-Path $worktreePath "node_modules"
New-WorktreeDirectoryLink $worktreeNodeModules $mainNodeModules


$mainGeneratedDocs = Join-Path $repoRoot "docs\codex\generated"
$worktreeGeneratedDocs = Join-Path $worktreePath "docs\codex\generated"
New-WorktreeDirectoryLink $worktreeGeneratedDocs $mainGeneratedDocs

if ($UseDirtyMainSnapshot) {
  Write-Host "[composer:invoke] copy dirty main snapshot"
  $dirtyFiles | Set-Content -Path (Join-Path $runDir "main-dirty-files.txt")
  Copy-DirtyMainSnapshot $repoRoot $worktreePath ([string[]]$dirtyFiles) $runDir
}

$briefPath = Join-Path $runDir "brief.md"
if (-not (Test-Path $briefPath)) {
  @"
# Composer Task $taskId

Objective: $($task.objective)

Read task.json in this run directory. Implement only that contract.
"@ | Set-Content -Path $briefPath
}

$workerTaskDir = Join-Path $worktreePath ".composer-task"
New-Item -ItemType Directory -Force -Path $workerTaskDir | Out-Null
$workerTaskJson = Join-Path $workerTaskDir "task.json"
$workerBrief = Join-Path $workerTaskDir "brief.md"
Copy-Item -LiteralPath $taskPath -Destination $workerTaskJson
Copy-Item -LiteralPath $briefPath -Destination $workerBrief

$promptBriefPath = $workerBrief
$promptTaskPath = $workerTaskJson
if ($backend -eq "wsl") {
  $distro = if ($config.PSObject.Properties.Name -contains "wsl_distro") { [string]$config.wsl_distro } else { "Ubuntu-24.04" }
  $user = if ($config.PSObject.Properties.Name -contains "wsl_user") { [string]$config.wsl_user } else { "root" }
  $promptBriefPath = Convert-ToWslPath $distro $user $workerBrief
  $promptTaskPath = Convert-ToWslPath $distro $user $workerTaskJson
}

$prompt = @"
Implement exactly the task in:
- $promptBriefPath
- $promptTaskPath

The contract is controller-owned and immutable.
Work only inside allowed paths.
Do not redesign.
Do not read secrets or local durable app data.
Do not use the network for project research or financial data.
Do not invoke any AI agent, Codex, Cursor agent, skill, or MCP.
Do not commit, push, branch, install, upgrade, or change dependencies.
Do not use experimental runtime flags, transpiler workarounds, or dependency workarounds unless task.json explicitly permits them.
Run only the exact specified checks. If a check launcher such as npm is unavailable in your environment, do not substitute a different command; report the unavailable launcher and let the controller wrapper run the specified checks.
Return BLOCKED if a stop condition occurs.
Return only this compact report:
- changed_files
- checks_run
- assumptions
- codex_attention_needed: true/false
"@

$stdout = Join-Path $logsDir "composer.stdout.log"
$stderr = Join-Path $logsDir "composer.stderr.log"
$agentProcessLog = Join-Path $logsDir "composer.process.log"
$agentTimedOut = $false
if ($backend -eq "wsl") {
  $distro = if ($config.PSObject.Properties.Name -contains "wsl_distro") { [string]$config.wsl_distro } else { "Ubuntu-24.04" }
  $user = if ($config.PSObject.Properties.Name -contains "wsl_user") { [string]$config.wsl_user } else { "root" }
  $agentPath = if ($config.PSObject.Properties.Name -contains "wsl_agent_path") { [string]$config.wsl_agent_path } else { "/root/.local/bin/agent" }
  $wslWorktreePath = Convert-ToWslPath $distro $user $worktreePath
  $wslStdout = Convert-ToWslPath $distro $user $stdout
  $wslStderr = Convert-ToWslPath $distro $user $stderr
  $agentArgs = @($agentPath, "--print", "--trust", "--sandbox", "enabled", "--workspace", $wslWorktreePath, "--model", [string]$config.model, "--output-format", $agentOutputFormat, $prompt)
  $quotedAgentCommand = ($agentArgs | ForEach-Object { Quote-BashArg $_ }) -join " "
  $command = "cd $(Quote-BashArg $wslWorktreePath) && $quotedAgentCommand > $(Quote-BashArg $wslStdout) 2> $(Quote-BashArg $wslStderr)"
  $timeoutCommand = "timeout --kill-after=15s ${agentTimeoutSeconds}s bash -lc $(Quote-BashArg $command)"
  $agentRun = Invoke-WslCaptured $distro $user @("bash", "-lc", $timeoutCommand)
  $agentExit = $agentRun.ExitCode
  $agentRun.Output | Set-Content -Path $agentProcessLog
  if ($agentExit -eq 124 -or $agentExit -eq 137) {
    $agentTimedOut = $true
    "Cursor Agent timed out after $agentTimeoutSeconds seconds. See composer.stdout.log, composer.stderr.log, and composer.process.log." | Set-Content -Path (Join-Path $runDir "agent-timeout.txt")
  }
} else {
  $agentPath = Resolve-AgentCommand
  if (-not $agentPath) {
    Write-Error "No working Cursor agent launcher found."
    exit 2
  }
  Push-Location $worktreePath
  try {
    $agentArgs = @("--print", "--trust", "--sandbox", "enabled", "--model", [string]$config.model, "--output-format", $agentOutputFormat, $prompt)
    & $agentPath @agentArgs 1> $stdout 2> $stderr
    $agentExit = $LASTEXITCODE
  } finally {
    Pop-Location
  }
}

Remove-DisposableGeneratedArtifacts $worktreePath

$untrackedAfterRun = @(& git -C $worktreePath ls-files --others --exclude-standard -- . | Where-Object {
  $normalized = $_.Replace("\", "/")
  $_ -and $normalized -notlike ".composer-task/*" -and $normalized -ne ".composer-task" -and -not (Test-GeneratedArtifactPath $normalized)
})
if ($untrackedAfterRun.Count -gt 0) {
  & git -C $worktreePath add -N -- $untrackedAfterRun
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
$changedOutput = @()
$changedOutput += & git -C $worktreePath diff --name-only
$changedOutput += & git -C $worktreePath ls-files --others --exclude-standard -- . ":(exclude).composer-task" | Where-Object {
  -not (Test-GeneratedArtifactPath $_)
}
$changedFiles = @($changedOutput | Where-Object { $_ } | Sort-Object -Unique)
$changedFiles | Set-Content -Path (Join-Path $runDir "changed-files.txt")
& git -C $worktreePath diff --stat | Set-Content -Path (Join-Path $runDir "diff-stat.txt")
& git -C $worktreePath diff --binary | Set-Content -Path (Join-Path $runDir "implementation.patch")

$violations = @()
foreach ($file in $changedFiles) {
  if (-not (Match-TaskPath $file ([string[]]$task.allowed_paths))) {
    $violations += "Changed outside allowed_paths: $file"
  }
  if (Match-TaskPath $file ([string[]]$task.forbidden_paths)) {
    $violations += "Changed forbidden path: $file"
  }
  if ($file -match "(^|/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|requirements.*\.txt|pyproject\.toml|\.env.*)$" -or $file -like "data/*") {
    $violations += "Changed protected path: $file"
  }
}

$allowExperimentalRuntime = $false
if ($task.PSObject.Properties.Name -contains "allow_experimental_runtime") {
  $allowExperimentalRuntime = [bool]$task.allow_experimental_runtime
}
if (-not $allowExperimentalRuntime) {
  foreach ($file in $changedFiles) {
    $addedLines = Get-AddedDiffLines $worktreePath $file
    $experimentalMatch = $addedLines | Select-String -Pattern "--experimental-", "experimental-strip-types" -SimpleMatch | Select-Object -First 1
    if ($experimentalMatch) {
      $violations += "Experimental runtime workaround found without allow_experimental_runtime: $file"
    }
  }
}

$diffLines = (& git -C $worktreePath diff --numstat | ForEach-Object {
  $parts = $_ -split "\s+"
  if ($parts.Length -ge 2) {
    $add = if ($parts[0] -match "^\d+$") { [int]$parts[0] } else { 0 }
    $del = if ($parts[1] -match "^\d+$") { [int]$parts[1] } else { 0 }
    $add + $del
  }
} | Measure-Object -Sum).Sum
if (-not $diffLines) { $diffLines = 0 }

if ($changedFiles.Count -gt [int]$task.max_files_changed) {
  $violations += "Too many files changed: $($changedFiles.Count) > $($task.max_files_changed)"
}
if ($diffLines -gt [int]$task.max_diff_lines) {
  $violations += "Too many diff lines: $diffLines > $($task.max_diff_lines)"
}
if ($agentTimedOut) {
  $violations += "Cursor Agent timed out after $agentTimeoutSeconds seconds"
}

& git -C $worktreePath diff --check | Tee-Object -FilePath (Join-Path $logsDir "git-diff-check.log")
if ($LASTEXITCODE -ne 0) { $violations += "git diff --check failed" }

$checks = @()
Push-Location $worktreePath
try {
  $checkIndex = 0
  foreach ($command in $task.test_commands) {
    $checkIndex += 1
    $log = New-CheckLogPath $logsDir $checkIndex $command
    $checkResult = if ([System.Environment]::OSVersion.Platform -eq "Win32NT") {
      $checkCommand = Convert-ToCmdCheckCommand $command
      Invoke-Captured "cmd.exe" @("/d", "/c", $checkCommand)
    } else {
      Invoke-Captured "sh" @("-lc", $command)
    }
    $checkResult.Output | Set-Content -Path $log
    $checks += [pscustomobject]@{ command = $command; exit_code = $checkResult.ExitCode; log = $log }
    if ($checkResult.ExitCode -ne 0) { $violations += "Check failed: $command" }
  }
} finally {
  Pop-Location
}
Remove-WorktreeDirectoryLink $worktreeNodeModules
Remove-WorktreeDirectoryLink $worktreeGeneratedDocs

$summary = [pscustomobject]@{
  task_id = $taskId
  status = if ($agentExit -eq 0 -and $violations.Count -eq 0) { "needs-codex-review" } else { "failed" }
  composer_exit_code = $agentExit
  agent_timed_out = $agentTimedOut
  agent_timeout_seconds = $agentTimeoutSeconds
  agent_output_format = $agentOutputFormat
  changed_files = $changedFiles.Count
  diff_lines = $diffLines
  violations = $violations
  checks = $checks
  patch = Join-Path $runDir "implementation.patch"
}
$summary | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $runDir "review.json")

& node (Join-Path $repoRoot "scripts\composer\summarize-run.cjs") $stdout $stderr | Set-Content -Path (Join-Path $runDir "checks-summary.md")
& node (Join-Path $repoRoot "scripts\composer\review-run.cjs") $runDir | Set-Content -Path (Join-Path $runDir "review-summary.md")

$summary | ConvertTo-Json -Depth 6
if ($summary.status -ne "needs-codex-review") { exit 1 }
