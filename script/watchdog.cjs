/**
 * Health watchdog for Mono5
 * 
 * Runs as a PM2-managed process that periodically checks:
 *   1. Server is responding on port 5000
 *   2. ngrok tunnels are active
 * 
 * If either is down, it triggers a PM2 restart of the failed process.
 */
const { execSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const LOG_DIR = "D:\\Mono5\\logs";
const CHECK_INTERVAL_MS = 30_000; // Check every 30 seconds
const SERVER_PORT = 5000;
const NGROK_API = "http://127.0.0.1:4040/api/tunnels";
const REQUIRED_TUNNELS = ["carengine"];

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function timestamp() {
  return new Date().toISOString();
}

function log(msg) {
  const line = `[${timestamp()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(
    path.join(LOG_DIR, "watchdog.log"),
    line + "\n"
  );
}

function httpGet(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function pm2Restart(processName) {
  try {
    log(`⚠ Restarting ${processName} via PM2...`);
    execSync(`pm2 restart ${processName}`, {
      encoding: "utf-8",
      timeout: 30000,
      env: { ...process.env, PATH: process.env.PATH + ";C:\\Users\\Osheen\\AppData\\Roaming\\npm" },
    });
    log(`✓ ${processName} restart command sent`);
  } catch (err) {
    log(`✗ Failed to restart ${processName}: ${err.message}`);
  }
}

function restartNgrokService() {
  try {
    log(`⚠ Restarting ngrok Windows service...`);
    execSync(`net stop ngrok & net start ngrok`, {
      encoding: "utf-8",
      timeout: 30000,
      shell: true,
    });
    log(`✓ ngrok service restarted`);
  } catch (err) {
    log(`✗ Failed to restart ngrok service: ${err.message}`);
    // Try alternative: just start it if it's stopped
    try {
      execSync(`net start ngrok`, { encoding: "utf-8", timeout: 15000, shell: true });
      log(`✓ ngrok service started (was stopped)`);
    } catch { /* already running or no perms */ }
  }
}

async function checkServer() {
  try {
    const res = await httpGet(`http://127.0.0.1:${SERVER_PORT}/`);
    if (res.status >= 200 && res.status < 500) {
      return true;
    }
    log(`Server responded with status ${res.status}`);
    return false;
  } catch (err) {
    log(`Server health check failed: ${err.message}`);
    return false;
  }
}

async function checkNgrokTunnels() {
  try {
    const res = await httpGet(NGROK_API);
    if (res.status !== 200) {
      log(`ngrok API returned status ${res.status}`);
      return false;
    }
    const data = JSON.parse(res.data);
    const tunnelNames = data.tunnels.map((t) => t.name);
    const missing = REQUIRED_TUNNELS.filter((t) => !tunnelNames.includes(t));
    if (missing.length > 0) {
      log(`Missing tunnels: ${missing.join(", ")}`);
      return false;
    }
    return true;
  } catch (err) {
    log(`ngrok health check failed: ${err.message}`);
    return false;
  }
}

let consecutiveServerFailures = 0;
let consecutiveNgrokFailures = 0;
const FAILURE_THRESHOLD = 2; // Restart after 2 consecutive failures (1 minute)

async function runChecks() {
  // Check server
  const serverOk = await checkServer();
  if (serverOk) {
    consecutiveServerFailures = 0;
  } else {
    consecutiveServerFailures++;
    if (consecutiveServerFailures >= FAILURE_THRESHOLD) {
      log(`Server has been down for ${consecutiveServerFailures} checks — triggering restart`);
      pm2Restart("mono5-server");
      consecutiveServerFailures = 0;
    }
  }

  // Check ngrok
  const ngrokOk = await checkNgrokTunnels();
  if (ngrokOk) {
    consecutiveNgrokFailures = 0;
  } else {
    consecutiveNgrokFailures++;
    if (consecutiveNgrokFailures >= FAILURE_THRESHOLD) {
      log(`ngrok has been down for ${consecutiveNgrokFailures} checks — triggering service restart`);
      restartNgrokService();
      consecutiveNgrokFailures = 0;
    }
  }
}

log("Watchdog started — monitoring server and ngrok tunnels");
log(`Check interval: ${CHECK_INTERVAL_MS / 1000}s | Failure threshold: ${FAILURE_THRESHOLD} consecutive failures`);

// Run initial check after a short delay (let things start up)
setTimeout(runChecks, 10_000);

// Then run on interval
setInterval(runChecks, CHECK_INTERVAL_MS);

// Keep alive
process.on("SIGINT", () => {
  log("Watchdog shutting down");
  process.exit(0);
});
