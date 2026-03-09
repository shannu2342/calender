/**
 * ecosystem.config.cjs
 * ────────────────────────────────────────────────────────────────
 * PM2 Process Manager configuration file.
 *
 * PM2 is a production process manager that:
 *   - Keeps your Node.js app running 24/7 (auto-restarts on crash)
 *   - Manages log files automatically
 *   - Allows zero-downtime restarts
 *   - Starts automatically when your server reboots
 *
 * NOTE: Must be .cjs extension because our project uses "type": "module" in package.json
 *       PM2 config files must be in CommonJS format.
 *
 * Usage:
 *   cd backend
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup       (follow instructions to auto-start on boot)
 */

module.exports = {
    apps: [
        {
            // ── App Identity ────────────────────────────────────────────
            name: "panchang-backend",   // PM2 app name (used in pm2 list)
            script: "server.js",        // Entry point file
            cwd: "./",                  // Run from backend folder

            // ── Node.js Mode ────────────────────────────────────────────
            // "fork" = one process (recommended for this app)
            // "cluster" = multiple CPU cores (only if you need more performance)
            exec_mode: "fork",
            instances: 1,               // Single instance is fine for now

            // ── Environment ─────────────────────────────────────────────
            // PM2 will load your .env file automatically when NODE_ENV is set
            env: {
                NODE_ENV: "production",
                // All other secrets come from .env file
            },
            env_development: {
                NODE_ENV: "development",
            },

            // ── Auto-Restart Settings ────────────────────────────────────
            // PM2 will restart the app if it crashes
            autorestart: true,
            watch: false,               // Don't watch files in production (too slow)
            max_memory_restart: "500M", // Restart if it uses more than 500MB RAM

            // ── Cron Restart (optional) ──────────────────────────────────
            // Restart the app every day at 3 AM to clear memory leaks
            // cron_restart: "0 3 * * *",

            // ── Log Files ───────────────────────────────────────────────
            // PM2 writes logs here. View with: pm2 logs panchang-backend
            error_file: "./logs/pm2-error.log",
            out_file: "./logs/pm2-out.log",
            log_date_format: "YYYY-MM-DD HH:mm:ss",
            merge_logs: true,           // Merge stdout + stderr into one stream

            // ── Graceful Shutdown ────────────────────────────────────────
            // Wait up to 10 seconds for in-flight requests before killing process
            kill_timeout: 10000,
            listen_timeout: 10000,

            // ── Startup ─────────────────────────────────────────────────
            min_uptime: "5s",           // App must stay up 5s to be considered "started"
            max_restarts: 10,           // Stop restarting after 10 failures (prevents crash loop)
        },
    ],
};
