/**
 * models/Compass.js
 * ────────────────────────────────────────────────────────────────
 * Stores raw Compass (Vastu directional astrology) data from the Prokerala API.
 * One document = one day's compass data.
 *
 * ✅ INDEXES:
 *   - { date: 1 }             — fast single-date lookups
 *   - { year: 1 }             — fast full-year queries
 *   - { year: 1, date: 1 }    — compound unique (prevents duplicates)
 */

import mongoose from "mongoose";

const CompassSchema = new mongoose.Schema(
    {
        date: { type: String, required: true },
        year: { type: Number, required: true },
        rawData: { type: mongoose.Schema.Types.Mixed, required: true },
        fetchedAt: { type: Date, default: Date.now },
    },
    {
        timestamps: true,
        collection: "Compass",
    }
);

CompassSchema.index({ date: 1 });
CompassSchema.index({ year: 1 });
CompassSchema.index({ year: 1, date: 1 }, { unique: true });

export default mongoose.model("Compass", CompassSchema);
