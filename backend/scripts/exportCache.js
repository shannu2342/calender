/**
 * Export existing cache from local database to seed file.
 * Run this to export your current cache: node scripts/exportCache.js
 */

import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path
const DB_DIR = path.resolve(__dirname, "../data");
const DB_PATH = path.join(DB_DIR, "panchang_cache.db");
const SEED_OUTPUT_PATH = path.join(DB_DIR, "panchang_cache_seed.json");

function exportCache() {
  if (!fs.existsSync(DB_PATH)) {
    console.log("[Export] Database not found at:", DB_PATH);
    console.log("[Export] Make sure the backend is running and has cached some data!");
    return;
  }

  const db = new Database(DB_PATH, { readonly: true });

  // Get all cache entries
  const entries = db.prepare("SELECT * FROM panchang_cache").all();
  
  if (entries.length === 0) {
    console.log("[Export] No cache entries found!");
    console.log("[Export] The database is empty. Run the backend first to generate some cache.");
    db.close();
    return;
  }

  console.log(`[Export] Found ${entries.length} cached entries`);

  // Save to seed file
  fs.writeFileSync(SEED_OUTPUT_PATH, JSON.stringify(entries, null, 2));
  console.log(`[Export] Exported to: ${SEED_OUTPUT_PATH}`);

  // Print stats
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_entries,
      COUNT(DISTINCT date) as unique_dates,
      COUNT(DISTINCT language) as unique_languages,
      COUNT(DISTINCT latitude || ',' || longitude) as unique_locations
    FROM panchang_cache
  `).get();
  
  console.log("[Export] Stats:", stats);

  db.close();
  console.log("[Export] Done!");
}

exportCache();
