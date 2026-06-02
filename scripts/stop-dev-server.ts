import { execFileSync } from "node:child_process";
import os from "node:os";

const DEFAULT_PORT = 3000;
const SAFE_PROCESS_NAMES = new Set(["node", "node.exe"]);

function main() {
  const port = readPort(process.argv.slice(2));

  if (os.platform() === "win32") {
    stopWindowsListeners(port);
    return;
  }

  stopUnixListeners(port);
}

function readPort(args: string[]) {
  const portArg = args[0] ?? process.env.PORT;
  const port = portArg ? Number(portArg) : DEFAULT_PORT;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be an integer from 1 to 65535.");
  }

  return port;
}

function stopWindowsListeners(port: number) {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$port = ${port}`,
    "$listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue",
    "if (-not $listeners) { Write-Output \"No listener found on port $port.\"; exit 0 }",
    "$pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique",
    "foreach ($listenerPid in $pids) {",
    "  $process = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue",
    "  if (-not $process) { continue }",
    "  if ($process.ProcessName -notin @('node')) {",
    "    Write-Output \"Skipping PID $listenerPid ($($process.ProcessName)); not a known dev server process.\"",
    "    continue",
    "  }",
    "  Stop-Process -Id $listenerPid -Force",
    "  Write-Output \"Stopped PID $listenerPid ($($process.ProcessName)) on port $port.\"",
    "}"
  ].join("; ");

  execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
    stdio: "inherit"
  });
}

function stopUnixListeners(port: number) {
  const output = execFileSync("sh", [
    "-c",
    `lsof -nP -iTCP:${port} -sTCP:LISTEN -Fp -Fc 2>/dev/null || true`
  ], {
    encoding: "utf8"
  });
  const listeners = parseLsofOutput(output);

  if (listeners.length === 0) {
    console.log(`No listener found on port ${port}.`);
    return;
  }

  for (const listener of listeners) {
    if (!SAFE_PROCESS_NAMES.has(listener.command.toLowerCase())) {
      console.log(
        `Skipping PID ${listener.pid} (${listener.command}); not a known dev server process.`
      );
      continue;
    }

    process.kill(listener.pid, "SIGTERM");
    console.log(`Stopped PID ${listener.pid} (${listener.command}) on port ${port}.`);
  }
}

function parseLsofOutput(output: string) {
  const listeners: Array<{ command: string; pid: number }> = [];
  let currentPid: number | undefined;
  let currentCommand: string | undefined;

  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue;
    }

    if (line.startsWith("p")) {
      currentPid = Number(line.slice(1));
      currentCommand = undefined;
      continue;
    }

    if (line.startsWith("c")) {
      currentCommand = line.slice(1);
    }

    if (currentPid && currentCommand) {
      listeners.push({
        command: currentCommand,
        pid: currentPid
      });
      currentPid = undefined;
      currentCommand = undefined;
    }
  }

  return listeners;
}

main();
