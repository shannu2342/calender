/**
 * models/Panchang.js
 * ────────────────────────────────────────────────────────────────
 * Stores raw Panchang data from the Prokerala API.
 * One document = one day's panchang.
 *
 * ✅ INDEXES (why they matter for 300k+ documents):
 * ─────────────────────────────────────────────────
 * Without indexes, MongoDB does a "collection scan" — it reads EVERY
 * document one by one to find matches. With 300,000+ documents, a
 * single query could take 5–10 seconds. With an index, it takes <5ms.
 *
 * Index on `date`:
 *   → Fast: Panchang.find({ date: "2026-01-01" }) — used by single-date endpoints
 *
 * Index on `year`:
 *   → Fast: Panchang.find({ year: 2026 }) — used by /year/:year route
 *   → Fast: Panchang.countDocuments({ year: 2026 }) — used by status checks
 *
 * Compound index { year: 1, date: 1 } with unique: true:
 *   → Fast: Panchang.find({ year: 2026, date: "2026-01-01" })
 *   → Prevents DUPLICATE documents (no two docs with same year + date)
 *   → If cron crashes mid-run and restarts, the unique index prevents
 *     re-inserting data that was already stored
 */

import mongoose from "mongoose";

const PanchangSchema = new mongoose.Schema(
    {
        // Date as YYYY-MM-DD string. Indexed for fast single-date lookups.
        date: {
            type: String,
            required: true,
        },

        // Numeric year. Indexed for fast year-wide queries.
        year: {
            type: Number,
            required: true,
        },

        // Complete raw API response stored as-is (no transformation)
        rawData: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },

        // Timestamp of when this record was fetched from the API
        fetchedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,        // Adds createdAt + updatedAt automatically
        collection: "Panchang",  // Exact MongoDB collection name
    }
);

// ─── Individual Indexes (for single-field queries) ─────────────────
PanchangSchema.index({ date: 1 }); // Fast: find by date
PanchangSchema.index({ year: 1 }); // Fast: find all of year 2026

// ─── Compound Unique Index (most important!) ───────────────────────
// Ensures NO TWO documents have the same year + date combination.
// This is the primary key for lookups and duplicate prevention.
PanchangSchema.index({ year: 1, date: 1 }, { unique: true });

export default mongoose.model("Panchang", PanchangSchema);
