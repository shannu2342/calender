/**
 * config/db.js
 * ────────────────────────────────────────────────────────────────
 * Connects to MongoDB using the MONGO_URI environment variable.
 * Works with BOTH:
 *   - Self-hosted MongoDB on VPS: mongodb://127.0.0.1:27017/panchang
 *   - Any MongoDB host — just change MONGO_URI in .env
 *
 * No Atlas-specific code here. Pure Mongoose + any MongoDB instance.
 *
 * Why Mongoose?
 *   - Schema validation before saving
 *   - Easy querying with helper methods
 *   - Automatic connection pooling
 */

import mongoose from "mongoose";
import logger from "./logger.js";

let isConnected = false;

/**
 * connectDB()
 * ───────────
 * Call once at startup (server.js).
 * Reads MONGO_URI from .env — no hardcoded connection string here.
 *
 * For VPS:    MONGO_URI=mongodb://127.0.0.1:27017/panchang
 * For remote: MONGO_URI=mongodb://username:password@host:27017/panchang
 */
export async function connectDB() {
    if (isConnected) {
        logger.info("[MongoDB] Already connected, skipping reconnect.");
        return;
    }

    const uri = process.env.MONGO_URI;

    if (!uri) {
        logger.error("[MongoDB] MONGO_URI is not set in .env!");
        throw new Error("MONGO_URI environment variable is required.");
    }

    try {
        logger.info("[MongoDB] Connecting to MongoDB...");
        logger.info(`[MongoDB] URI: ${uri.replace(/\/\/.*@/, "//***@")}`); // Hide credentials in logs

        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000, // Wait max 10s to find the server
            socketTimeoutMS: 45000,          // Drop idle connections after 45s
            maxPoolSize: 10,                 // Keep up to 10 parallel connections
        });

        isConnected = true;
        logger.info("✅ [MongoDB] Connected successfully!");

        // Log disconnection (e.g. mongod service restarted on VPS)
        mongoose.connection.on("disconnected", () => {
            logger.warn("[MongoDB] ⚠️ Disconnected. Mongoose will auto-reconnect.");
            isConnected = false;
        });

        // Log successful reconnect
        mongoose.connection.on("reconnected", () => {
            logger.info("[MongoDB] 🔁 Reconnected.");
            isConnected = true;
        });

        // Log connection errors
        mongoose.connection.on("error", (err) => {
            logger.error("[MongoDB] Connection error:", err.message);
        });

    } catch (err) {
        logger.error("[MongoDB] ❌ Failed to connect:", err.message);
        logger.error("[MongoDB] Is mongod running? Try: sudo systemctl status mongod");
        throw err;
    }
}

/**
 * closeDB()
 * ─────────
 * Called during graceful shutdown (SIGTERM / SIGINT from PM2 or Ctrl+C).
 */
export async function closeDB() {
    if (isConnected) {
        await mongoose.connection.close();
        isConnected = false;
        logger.info("[MongoDB] Connection closed gracefully.");
    }
}
