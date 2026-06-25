import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = readPort();
const APP_URL = `http://localhost:${PORT}`;
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const READY_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;

function readPort() {
  const raw = process.env.APEX_DEV_PORT ?? process.env.PORT ?? "3001";
  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("APEX_DEV_PORT/PORT must be an integer from 1 to 65535.");
  }

  return port;
}

async function waitForServerReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(APP_URL, { redirect: "manual" });

      if (response.status >= 200 && response.status < 500) {
        return true;
      }
    } catch {
      // Server still starting.
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return spawn("npm", ["run", "dev", "--", "-p", String(PORT)], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(PORT)
    },
    shell: true,
    stdio: "inherit"
  });
}

async function main() {
  console.log(`Starting Apex Lifespan on ${APP_URL} ...`);

  const devServer = startDevServer();
  let browserOpened = false;
  let shuttingDown = false;

  void waitForServerReady().then((ready) => {
    if (!ready) {
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
      if (code && code !== 0) {
        process.exitCode = code;
      }

      resolve();
    });
    devServer.on("error", reject);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
