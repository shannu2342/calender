/**
 * config/logger.js
 * ────────────────────────────────────────────────────────────────
 * Winston logger configuration.
 *
 * Why Winston instead of console.log?
 *   - Writes logs to FILES (not just terminal)
 *   - Has log LEVELS: error, warn, info, debug
 *   - PM2 can capture these log files
 *   - Timestamps on every message
 *   - Can be extended to send logs to cloud services
 *
 * Log Files created:
 *   - logs/error.log  → Only errors
 *   - logs/combined.log → All logs
 */

import winston from "winston";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Make sure the logs folder exists
const logsDir = path.resolve(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define how each log message looks
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // Add timestamp
    winston.format.errors({ stack: true }),                       // Include error stack traces
    winston.format.printf(({ timestamp, level, message, stack }) => {
        // Format: [2026-01-01 14:00:00] ERROR: Something went wrong
        return stack
            ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
            : `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
);

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info", // Default to 'info' level

    format: logFormat,

    transports: [
        // Write ALL logs to combined.log
        new winston.transports.File({
            filename: path.join(logsDir, "combined.log"),
            maxsize: 10 * 1024 * 1024, // Rotate when file reaches 10MB
            maxFiles: 5,               // Keep last 5 rotated files
        }),

        // Write only ERROR logs to error.log
        new winston.transports.File({
            filename: path.join(logsDir, "error.log"),
            level: "error",
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
        }),
    ],
});

// In development, also print to the terminal with colors
if (process.env.NODE_ENV !== "production") {
    logger.add(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(), // Colorize level labels
                logFormat
            ),
        })
    );
} else {
    // In production: also print to console (PM2 captures this)
    logger.add(
        new winston.transports.Console({ format: logFormat })
    );
}

export default logger;
