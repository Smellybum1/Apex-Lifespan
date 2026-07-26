<#
.SYNOPSIS
  Registers the headless local UPDATE pipeline as a Windows scheduled task.

.DESCRIPTION
  This is deliberately NOT a GitHub Actions workflow. The catalog this pipeline
  writes to is the local PostgreSQL at localhost:5432 on this machine. A hosted
  runner would spin up an empty ephemeral database, run the pipeline against it,
  and throw the results away — so a hosted cron cannot do this job at all, only
  smoke-test that the code starts.

  Running this script creates persistent configuration on your machine and the
  task will thereafter write to the catalog unattended. Nothing is registered
  until you run it yourself.

  Preview first:
    powershell -File scripts/register-pipeline-schedule.ps1 -WhatIf

  Register:
    powershell -File scripts/register-pipeline-schedule.ps1

  Remove:
    Unregister-ScheduledTask -TaskName "Apex Lifespan pipeline" -Confirm:$false

.PARAMETER At
  Daily start time, 24h "HH:mm". Default 03:00 — outside working hours because
  the run holds database connections and hits PubMed/ClinicalTrials.gov.

.PARAMETER MaxJobs
  Ingestion jobs per run. The pipeline leaves queued jobs in the database, so a
  modest cap simply means the next run resumes where this one stopped.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$At = "03:00",
  [int]$MaxJobs = 100,
  [string]$TaskName = "Apex Lifespan pipeline"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $projectRoot "logs"
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue)

if (-not $npm) {
  throw "npm.cmd is not on PATH. Scheduled tasks do not inherit your shell PATH, so it must resolve globally."
}

if (-not (Test-Path $logDirectory)) {
  New-Item -ItemType Directory -Path $logDirectory | Out-Null
}

# cmd.exe wrapper so both streams land in a dated log; Task Scheduler captures
# neither on its own, and a silent unattended writer is not worth having.
$logPath = Join-Path $logDirectory "pipeline-run.log"
$command = "`"$($npm.Source)`" run pipeline:run -- --max-jobs $MaxJobs --quiet >> `"$logPath`" 2>&1"

# The whole command is wrapped in one more pair of quotes on purpose. Given
# `/c "prog" args > "file"`, cmd.exe strips the FIRST and LAST quote it sees
# rather than treating them as a pair around the program name — which leaves an
# unbalanced string, and cmd exits 1 with "The filename, directory name, or
# volume label syntax is incorrect" before creating the log. The failure is
# silent from Task Scheduler's side: the task reports a plain non-zero result
# and there is no log to explain it, because writing the log is what failed.
# The extra wrapper is the pair cmd consumes, leaving the inner quoting intact.
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$command`"" -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 4)

if ($PSCmdlet.ShouldProcess($TaskName, "Register daily at $At (max $MaxJobs jobs), logging to $logPath")) {
  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Headless local evidence UPDATE pipeline. Writes AI-reviewed rows to the local catalog; never stamps Human reviewed." `
    -Force | Out-Null

  Write-Output "Registered '$TaskName' daily at $At."
  Write-Output "Log: $logPath"
  Write-Output "Remove with: Unregister-ScheduledTask -TaskName `"$TaskName`" -Confirm:`$false"
}
