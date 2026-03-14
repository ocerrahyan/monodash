/**
 * Starts the ngrok tunnel for the carengine app.
 * 
 * Usage:
 *   npx tsx script/ngrok-tunnel.ts          # Start only the carengine tunnel
 *   npx tsx script/ngrok-tunnel.ts --all    # Start all tunnels (hyehall, varouj, carengine)
 * 
 * The carengine tunnel maps:
 *   https://carengine.ngrok.app  →  http://localhost:5000
 * 
 * Prerequisites:
 *   - The Mono5 dev server must be running on port 5000 (`npm run dev`)
 *   - ngrok authtoken must be configured (already done in global config)
 */
import { execSync, spawn } from "child_process";

const args = process.argv.slice(2);
const startAll = args.includes("--all");

// Resolve npx-managed ngrok binary path
function getNgrokBin(): string {
  try {
    const p = execSync("npx which ngrok", { encoding: "utf-8" }).trim();
    return p || "npx ngrok";
  } catch {
    return "npx ngrok";
  }
}

/**
 * Check if a tunnel is already running by querying the ngrok local API
 */
async function getRunningTunnels(): Promise<string[]> {
  try {
    const res = await fetch("http://localhost:4040/api/tunnels");
    if (!res.ok) return [];
    const data = (await res.json()) as { tunnels: { name: string }[] };
    return data.tunnels.map((t) => t.name);
  } catch {
    return [];
  }
}

async function main() {
  const running = await getRunningTunnels();

  if (running.includes("carengine")) {
    console.log("✓ carengine tunnel is already running at https://carengine.ngrok.app");
    if (!startAll) {
      process.exit(0);
    }
  }

  if (startAll) {
    // Start ALL tunnels defined in the global ngrok config
    // ngrok will bind to each domain on its respective port
    console.log("Starting all ngrok tunnels (hyehall, varouj, carengine)...");
    console.log("  hyehall  → http://localhost:3000 → https://hyehall.ngrok.app");
    console.log("  varouj   → http://localhost:4001 → https://varouj.ngrok.app");
    console.log("  carengine → http://localhost:5000 → https://carengine.ngrok.app");
    console.log("");

    const child = spawn("npx", ["ngrok", "start", "--all"], {
      stdio: "inherit",
      shell: true,
    });
    child.on("exit", (code) => process.exit(code ?? 0));
  } else {
    // Start only the carengine tunnel
    if (running.length > 0) {
      // ngrok is already running with other tunnels — use the API to add ours
      console.log(`ngrok agent already running with tunnels: ${running.join(", ")}`);
      console.log("Starting carengine tunnel alongside existing tunnels...");

      const child = spawn(
        "npx",
        ["ngrok", "start", "carengine"],
        { stdio: "inherit", shell: true }
      );
      child.on("exit", (code) => process.exit(code ?? 0));
    } else {
      // No ngrok running yet — start just carengine
      console.log("Starting carengine tunnel...");
      console.log("  http://localhost:5000 → https://carengine.ngrok.app");
      console.log("");

      const child = spawn(
        "npx",
        ["ngrok", "start", "carengine"],
        { stdio: "inherit", shell: true }
      );
      child.on("exit", (code) => process.exit(code ?? 0));
    }
  }
}

main().catch((err) => {
  console.error("Failed to start ngrok:", err);
  process.exit(1);
});
