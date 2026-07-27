import { execFile, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { loadEnvFile } from "../src/lib/env-file";

const PORT = readPort();
const APP_URL = `http://localhost:${PORT}`;
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const READY_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;
const EXISTING_SERVER_TIMEOUT_MS = 2_000;
const DOCKER_READY_TIMEOUT_MS = 120_000;
const POSTGRES_READY_TIMEOUT_MS = 60_000;
const execFileAsync = promisify(execFile);

function readPort() {
  const raw = process.env.APEX_DEV_PORT ?? process.env.PORT ?? "3001";
  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("APEX_DEV_PORT/PORT must be an integer from 1 to 65535.");
  }

  return port;
}

async function waitForServerReady(signal?: AbortSignal) {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline && !signal?.aborted) {
    try {
      const response = await fetch(APP_URL, {
        redirect: "manual",
        signal
      });

      if (response.status >= 200 && response.status < 500) {
        return true;
      }
    } catch {
      // Server still starting.
    }

    await sleep(POLL_INTERVAL_MS, signal);
  }

  return false;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(undefined);
      return;
    }

    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(undefined);
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      resolve(undefined);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function openBrowser(url: string) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore"
    }).unref();
    return;
  }

  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

function startDevServer(): ChildProcess {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npm", "run", "dev", "--", "-p", String(PORT)]
      : ["run", "dev", "--", "-p", String(PORT)];

  return spawn(command, args, {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(PORT)
    },
    stdio: "inherit"
  });
}

async function main() {
  console.log(`Starting Apex Lifespan on ${APP_URL} ...`);

  await ensureLocalEvidenceDatabase();

  const existingServer = await probeExistingServer();

  if (existingServer.ready) {
    console.log(`Apex Lifespan is already running on ${APP_URL}; opening it.`);
    openBrowser(APP_URL);
    return;
  }

  if (existingServer.portInUse) {
    const detail =
      existingServer.status === undefined
        ? "did not return an HTTP response"
        : `returned HTTP ${existingServer.status}`;

    console.error(
      `Port ${PORT} is already in use but ${detail}. Run "npm run dev:stop -- ${PORT}" and then try "npm run dev:open" again.`
    );
    process.exitCode = 1;
    return;
  }

  const devServer = startDevServer();
  const readyController = new AbortController();
  let browserOpened = false;
  let shuttingDown = false;

  void waitForServerReady(readyController.signal).then((ready) => {
    if (!ready) {
      if (readyController.signal.aborted) {
        return;
      }

      console.error(`Timed out waiting for ${APP_URL} to become ready.`);
      return;
    }

    if (!browserOpened) {
      browserOpened = true;
      console.log(`Opening ${APP_URL}`);
      openBrowser(APP_URL);
    }
  });

  const shutdown = (signal?: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    if (!devServer.killed) {
      devServer.kill(signal ?? "SIGTERM");
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await new Promise<void>((resolve, reject) => {
    devServer.on("exit", (code) => {
      readyController.abort();

      if (code && code !== 0) {
        process.exitCode = code;
      }

      resolve();
    });
    devServer.on("error", reject);
  });
}

function readLauncherEnv() {
  const fileEnv: Record<string, string> = {};

  for (const name of [".env", ".env.local"]) {
    const filePath = path.join(ROOT_DIR, name);

    if (existsSync(filePath)) {
      Object.assign(fileEnv, loadEnvFile(filePath).env);
    }
  }

  return {
    ...fileEnv,
    ...process.env
  };
}

export function requiresLocalDockerPostgres(
  env: Record<string, string | undefined>
) {
  if (env.APEX_DATA_SOURCE !== "database" || !env.DATABASE_URL) {
    return false;
  }

  try {
    const databaseUrl = new URL(env.DATABASE_URL);
    const port = Number(databaseUrl.port || 5432);
    const databaseName = databaseUrl.pathname.replace(/^\//, "");

    return (
      ["postgres:", "postgresql:"].includes(databaseUrl.protocol) &&
      ["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname) &&
      port === 5432 &&
      databaseName === "apex_lifespan"
    );
  } catch {
    return false;
  }
}

async function ensureLocalEvidenceDatabase() {
  if (!requiresLocalDockerPostgres(readLauncherEnv())) {
    return;
  }

  if (!(await dockerDaemonReady())) {
    startDockerDesktop();
    console.log("Docker Desktop is not running; starting it for the local evidence database ...");

    if (!(await waitForDockerDaemon())) {
      throw new Error(
        "Docker Desktop did not become ready. Start Docker Desktop, then run Apex Lifespan again."
      );
    }
  }

  console.log("Starting the local evidence database ...");

  try {
    await runDocker(["compose", "up", "-d", "postgres"], DOCKER_READY_TIMEOUT_MS);
  } catch {
    throw new Error(
      "The local evidence database could not be started with Docker Compose. Check Docker Desktop and try again."
    );
  }

  if (!(await waitForPostgres())) {
    throw new Error(
      "The local evidence database started but did not become ready in time. Check Docker Desktop and try again."
    );
  }

  console.log("Local evidence database is ready.");
}

function startDockerDesktop() {
  const candidates = [
    process.env.ProgramFiles
      ? path.join(process.env.ProgramFiles, "Docker", "Docker", "Docker Desktop.exe")
      : undefined,
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Docker", "Docker Desktop.exe")
      : undefined
  ].filter((candidate): candidate is string => Boolean(candidate));
  const executable = candidates.find((candidate) => existsSync(candidate));

  if (!executable) {
    throw new Error(
      "Docker Desktop is required for the local evidence database but was not found."
    );
  }

  spawn(executable, [], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  }).unref();
}

async function waitForDockerDaemon() {
  const deadline = Date.now() + DOCKER_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (await dockerDaemonReady()) {
      return true;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return false;
}

async function dockerDaemonReady() {
  try {
    await runDocker(["info", "--format", "{{.ServerVersion}}"], 10_000);
    return true;
  } catch {
    return false;
  }
}

async function waitForPostgres() {
  const deadline = Date.now() + POSTGRES_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      await runDocker(
        [
          "compose",
          "exec",
          "-T",
          "postgres",
          "pg_isready",
          "-U",
          "postgres",
          "-d",
          "apex_lifespan"
        ],
        10_000
      );
      return true;
    } catch {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  return false;
}

async function runDocker(args: string[], timeout: number) {
  await execFileAsync("docker", args, {
    cwd: ROOT_DIR,
    timeout,
    windowsHide: true
  });
}

async function probeExistingServer() {
  const portInUse = await isPortInUse(PORT);

  if (!portInUse) {
    return {
      portInUse: false,
      ready: false
    };
  }

  const status = await fetchExistingServerStatus();

  return {
    portInUse: true,
    ready: status !== undefined && status >= 200 && status < 500,
    status
  };
}

function isPortInUse(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.setTimeout(EXISTING_SERVER_TIMEOUT_MS, () => {
      socket.destroy();
      resolve(true);
    });
  });
}

async function fetchExistingServerStatus() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXISTING_SERVER_TIMEOUT_MS);

  try {
    const response = await fetch(APP_URL, {
      redirect: "manual",
      signal: controller.signal
    });

    return response.status;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
