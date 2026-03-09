/**
 * controllers/systemController.js
 * ────────────────────────────────────────────────────────────────
 * System monitoring endpoints.
 *
 * GET /api/system/db-stats
 *   → Reports actual MongoDB storage usage in MB.
 *   → No hardcoded Atlas limit — reports real DB size.
 *   → Warns at configurable threshold (DB_WARN_GB env var, default 10 GB).
 *   → When running on a VPS, storage is limited only by your VPS disk.
 *
 * HOW TO READ THE OUTPUT:
 *   dataSize    = raw size of your documents (actual JSON content)
 *   storageSize = actual bytes on disk (has padding/compression)
 *   indexSize   = extra space used by MongoDB indexes (for fast queries)
 *   totalUsed   = storageSize + indexSize (what physically occupies disk)
 *
 * ROUGH SIZE ESTIMATE (so you can plan disk space):
 *   185 years × 365 days × 5 endpoints = ~337,625 documents
 *   Each document ≈ 3–8 KB of raw Prokerala JSON
 *   Total estimate: ~1–3 GB (fits easily on any VPS with 20GB+ disk)
 *
 * DISK PLANNING:
 *   A standard 25GB VPS disk is more than sufficient.
 *   If your data grows larger, simply add a disk volume — no service limits.
 */

import mongoose from "mongoose";
import logger from "../config/logger.js";

// Warn when DB total size exceeds this many GB.
// Configurable via DB_WARN_GB in .env. Default: 10 GB.
// Example: If your VPS has 25 GB disk, set DB_WARN_GB=15 to warn at 60%.
const WARN_THRESHOLD_GB = parseFloat(process.env.DB_WARN_GB || "10");
const WARN_THRESHOLD_BYTES = WARN_THRESHOLD_GB * 1024 * 1024 * 1024;

/**
 * getDbStats(req, res)
 * ──────────────────────
 * GET /api/system/db-stats
 *
 * Uses MongoDB's built-in dbStats command.
 * Reports raw size, disk size, index size, and per-collection counts.
 */
export async function getDbStats(req, res) {
    try {
        const db = mongoose.connection.db;

        if (!db) {
            return res.status(503).json({
                success: false,
                error: "MongoDB is not connected yet. Start the server with a valid MONGO_URI.",
            });
        }

        // ── Database-level stats ───────────────────────────────────────
        // dbStats returns the full picture of what's on disk for this DB
        const dbStats = await db.command({ dbStats: 1, scale: 1 }); // scale=1 → bytes

        const dataSize = dbStats.dataSize || 0;
        const storageSize = dbStats.storageSize || 0;
        const indexSize = dbStats.indexSize || 0;
        const fsUsedSize = dbStats.fsUsedSize || 0; // Entire filesystem used (if available)
        const fsTotalSize = dbStats.fsTotalSize || 0; // Entire filesystem size (if available)
        const totalDbSize = storageSize + indexSize;  // What our DB uses on disk

        // ── Per-collection document counts ────────────────────────────
        const collectionNames = [
            "Panchang", "Muhurat", "Kundali", "HinduTime", "Compass",
            "FetchTracker", "JobTracker",
        ];

        const collectionStats = {};
        for (const name of collectionNames) {
            try {
                const count = await db.collection(name).estimatedDocumentCount();
                collectionStats[name] = { documentCount: count };
            } catch {
                collectionStats[name] = { documentCount: "N/A (collection not created yet)" };
            }
        }

        // ── Threshold check ────────────────────────────────────────────
        const dbGB = totalDbSize / 1024 / 1024 / 1024;
        const isWarning = totalDbSize >= WARN_THRESHOLD_BYTES;
        const isCritical = totalDbSize >= WARN_THRESHOLD_BYTES * 1.42; // ~142% of warn threshold

        // ── Log appropriately ──────────────────────────────────────────
        const usedMB = (totalDbSize / 1024 / 1024).toFixed(1);
        if (isCritical) {
            logger.error(
                `[SystemController] 🚨 DB CRITICAL: ${usedMB}MB used. ` +
                `Exceeds ${(WARN_THRESHOLD_GB * 1.42).toFixed(1)}GB threshold. Check VPS disk space!`
            );
        } else if (isWarning) {
            logger.warn(
                `[SystemController] ⚠️ DB WARNING: ${usedMB}MB used. ` +
                `Approaching ${WARN_THRESHOLD_GB}GB warning threshold. Monitor disk usage.`
            );
        } else {
            logger.info(`[SystemController] DB size: ${usedMB}MB — ✅ within normal range.`);
        }

        // ── Disk-level stats (if mongod reports them) ──────────────────
        const diskInfo = fsTotalSize > 0
            ? {
                diskTotalGB: `${(fsTotalSize / 1024 / 1024 / 1024).toFixed(2)} GB`,
                diskUsedGB: `${(fsUsedSize / 1024 / 1024 / 1024).toFixed(2)} GB`,
                diskFreeGB: `${((fsTotalSize - fsUsedSize) / 1024 / 1024 / 1024).toFixed(2)} GB`,
                diskUsedPct: `${((fsUsedSize / fsTotalSize) * 100).toFixed(1)}%`,
            }
            : { note: "Disk-level stats not available from this MongoDB host. Use 'df -h' on VPS." };

        return res.json({
            success: true,
            storage: {
                // Human-readable DB usage
                dataSize: `${(dataSize / 1024 / 1024).toFixed(2)} MB`,
                storageSize: `${(storageSize / 1024 / 1024).toFixed(2)} MB`,
                indexSize: `${(indexSize / 1024 / 1024).toFixed(2)} MB`,
                totalUsed: `${(totalDbSize / 1024 / 1024).toFixed(2)} MB`,

                // Raw bytes for programmatic use
                raw: { dataSize, storageSize, indexSize, totalDbSize },

                // Threshold config
                warnThreshold: `${WARN_THRESHOLD_GB} GB (set DB_WARN_GB in .env to change)`,
                status: isCritical ? "CRITICAL" : isWarning ? "WARNING" : "OK",

                recommendation: isCritical
                    ? `⛔ DB is very large (${dbGB.toFixed(1)}GB). Check VPS disk with: df -h`
                    : isWarning
                        ? `⚠️ DB is growing (${dbGB.toFixed(1)}GB). Monitor with: df -h on your VPS.`
                        : `✅ DB size is healthy (${(totalDbSize / 1024 / 1024).toFixed(1)} MB).`,
            },
            disk: diskInfo,
            database: {
                host: mongoose.connection.host,
                name: dbStats.db,
                totalCollections: dbStats.collections || 0,
                totalDocuments: dbStats.objects || 0,
                collections: collectionStats,
            },
            checkedAt: new Date().toISOString(),
        });

    } catch (err) {
        logger.error("[SystemController] db-stats error:", err.message);
        return res.status(500).json({
            success: false,
            error: "Failed to retrieve database stats.",
            details: err.message,
        });
    }
}
