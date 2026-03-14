/**
 * PM2 Ecosystem Configuration for Mono5
 * 
 * Manages:
 *   1. mono5-server   — The Express/Vite dev server on port 5000
 *   2. mono5-watchdog  — Health monitor that restarts server/ngrok if they fail
 * 
 * Note: ngrok tunnels are managed by a separate Windows Service (auto-start).
 *       The watchdog monitors both the server AND ngrok, restarting as needed.
 * 
 * Usage:
 *   pm2 start ecosystem.config.cjs          # Start all
 *   pm2 restart mono5-server                # Restart just the server
 *   pm2 logs                                # View logs
 *   pm2 save                                # Save process list for resurrection
 */
module.exports = {
  apps: [
    {
      name: "mono5-server",
      cwd: "D:\\Mono5",
      script: "node_modules\\tsx\\dist\\cli.mjs",
      args: "server/index.ts",
      interpreter: "node",
      env: {
        NODE_ENV: "development",
        PORT: "5000",
      },
      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_restarts: 100,          // Max restarts before PM2 gives up
      min_uptime: "10s",          // Consider started after 10s uptime
      restart_delay: 3000,        // Wait 3s between restarts
      exp_backoff_restart_delay: 1000, // Exponential backoff starting at 1s
      max_memory_restart: "1G",   // Restart if memory exceeds 1GB

      // Logging
      error_file: "D:\\Mono5\\logs\\mono5-server-error.log",
      out_file: "D:\\Mono5\\logs\\mono5-server-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Crash recovery — always restart on any exit
      stop_exit_codes: [],        // No exit code stops restart
    },
    {
      name: "mono5-watchdog",
      cwd: "D:\\Mono5",
      script: "script/watchdog.cjs",
      interpreter: "node",

      // Auto-restart
      autorestart: true,
      watch: false,
      max_restarts: 100,
      min_uptime: "5s",
      restart_delay: 5000,

      // Logging
      error_file: "D:\\Mono5\\logs\\watchdog-error.log",
      out_file: "D:\\Mono5\\logs\\watchdog-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      stop_exit_codes: [],
    },
  ],
};
