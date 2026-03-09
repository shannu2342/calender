/**
 * Seed script to pre-populate the panchang cache database.
 * Run this locally with: node backend/scripts/seedCache.js
 * 
 * This generates cache data from Prokerala API that can be bundled
 * with the deployment to avoid API calls in production.
 */

import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import axios from "axios";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file (in parent directory)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Database paths
const DB_DIR = path.resolve(__dirname, "../data");
const DB_PATH = path.join(DB_DIR, "panchang_cache.db");
const SEED_OUTPUT_PATH = path.join(DB_DIR, "panchang_cache_seed.json");

// Configuration - adjust these for your needs
const CONFIG = {
  // Locations to cache (add more as needed)
  locations: [
    { lat: 17.8025, lng: 79.5920, name: "Karimnagar" },
    { lat: 17.3934, lng: 78.4706, name: "Hyderabad" },
  ],
  // Date range to cache (start with smaller range for testing)
  startDate: "2026-02-01",
  endDate: "2026-02-28",
  // Languages
  languages: ["en", "te", "hi"],
  // Ayanamsa
  ayanamsa: 1,
};

// Prokerala API credentials - loaded from .env file
const PROKERALA_CONFIG = {
  clientId: process.env.PROKERALA_CLIENT_ID,
  clientSecret: process.env.PROKERALA_CLIENT_SECRET,
  tokenUrl: process.env.PROKERALA_TOKEN_URL || "https://api.prokerala.com/token",
  baseUrl: process.env.PROKERALA_BASE_URL || "https://api.prokerala.com/v2",
};

let accessToken = null;

/**
 * Get OAuth access token from Prokerala
 */
async function getAccessToken() {
  if (accessToken) return accessToken;

  try {
    const response = await axios.post(
      PROKERALA_CONFIG.tokenUrl || "https://api.prokerala.com/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: PROKERALA_CONFIG.clientId,
        client_secret: PROKERALA_CONFIG.clientSecret,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    accessToken = response.data.access_token;
    console.log("[Seed] Got access token");
    return accessToken;
  } catch (error) {
    console.error("[Seed] Failed to get access token:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * Fetch panchang data from Prokerala API (v2)
 * Uses the same format as the main backend
 */
async function fetchPanchang(date, lat, lng, language) {
  const token = await getAccessToken();
  const baseUrl = PROKERALA_CONFIG.baseUrl || "https://api.prokerala.com/v2";

  // Build coordinates string (same as backend)
  const coordinates = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  
  // Build datetime in ISO 8601 format with timezone (same as backend)
  // Format: YYYY-MM-DDTHH:MM:SS+05:30
  const datetime = `${date}T12:00:00+05:30`;

  const params = new URLSearchParams({
    coordinates: coordinates,
    datetime: datetime,
    ayanamsa: CONFIG.ayanamsa,
    la: language,
  });

  try {
    const response = await axios.get(`${baseUrl}/astrology/panchang?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    console.log(`[Seed] Fetched: ${date} ${language}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      // Token expired, reset and retry
      accessToken = null;
      return fetchPanchang(date, lat, lng, language);
    }
    console.error(`[Seed] API error for ${date} ${language}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Initialize database
 */
function initDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS panchang_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      ayanamsa INTEGER NOT NULL DEFAULT 1,
      language TEXT NOT NULL DEFAULT 'en',
      response_data TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      access_count INTEGER NOT NULL DEFAULT 0,
      last_accessed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_panchang_cache_lookup 
    ON panchang_cache(date, latitude, longitude, ayanamsa, language);
    
    CREATE INDEX IF NOT EXISTS idx_panchang_cache_access 
    ON panchang_cache(last_accessed_at);
  `);

  console.log("[Seed] Database initialized");
  return db;
}

/**
 * Generate cache key
 */
function generateCacheKey(date, lat, lng, ayanamsa, language) {
  const latFixed = Number(lat).toFixed(4);
  const lngFixed = Number(lng).toFixed(4);
  return `panchang:${date}:${latFixed},${lngFixed}:${ayanamsa}:${language}`;
}

/**
 * Store cache entry
 */
function storeCache(db, cacheKey, date, lat, lng, ayanamsa, language, data) {
  const stmt = db.prepare(`
    INSERT INTO panchang_cache (
      cache_key, date, latitude, longitude, ayanamsa, language, 
      response_data, created_at, updated_at, access_count, last_accessed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'), 0, strftime('%s', 'now'))
    ON CONFLICT(cache_key) DO UPDATE SET
      response_data = excluded.response_data,
      updated_at = strftime('%s', 'now'),
      access_count = panchang_cache.access_count,
      last_accessed_at = strftime('%s', 'now')
  `);

  stmt.run(
    cacheKey,
    date,
    lat,
    lng,
    ayanamsa,
    language,
    JSON.stringify(data)
  );
}

/**
 * Generate all date strings between start and end
 */
function getDateRange(start, end) {
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Main seeding function
 */
async function seed() {
  console.log("[Seed] Starting cache seeding...");
  console.log("[Seed] Config:", JSON.stringify(CONFIG, null, 2));

  // Check for API credentials
  if (!PROKERALA_CONFIG.clientId || !PROKERALA_CONFIG.clientSecret) {
    console.error("[Seed] ERROR: Prokerala credentials not found in environment");
    console.error("[Seed] Please set PROKERALA_CLIENT_ID and PROKERALA_CLIENT_SECRET");
    process.exit(1);
  }

  const db = initDatabase();
  const dates = getDateRange(CONFIG.startDate, CONFIG.endDate);
  
  console.log(`[Seed] Will cache ${dates.length} dates x ${CONFIG.locations.length} locations x ${CONFIG.languages.length} languages = ${dates.length * CONFIG.locations.length * CONFIG.languages.length} entries`);

  let successCount = 0;
  let errorCount = 0;

  // Fetch and cache all combinations
  for (const location of CONFIG.locations) {
    for (const date of dates) {
      for (const language of CONFIG.languages) {
        try {
          const cacheKey = generateCacheKey(date, location.lat, location.lng, CONFIG.ayanamsa, language);
          const data = await fetchPanchang(date, location.lat, location.lng, language);
          
          storeCache(db, cacheKey, date, location.lat, location.lng, CONFIG.ayanamsa, language, data);
          successCount++;
          
          // Delay to avoid rate limiting (5 requests per 60 seconds)
          // Reduced delay since API seems to allow more requests
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          errorCount++;
          console.error(`[Seed] Failed: ${date} ${location.name} ${language}`);
        }
      }
    }
  }

  console.log(`[Seed] Completed: ${successCount} success, ${errorCount} errors`);

  // Export seed data
  const seedData = db.prepare("SELECT * FROM panchang_cache").all();
  fs.writeFileSync(SEED_OUTPUT_PATH, JSON.stringify(seedData, null, 2));
  console.log(`[Seed] Exported seed data to: ${SEED_OUTPUT_PATH}`);
  
  // Also export as SQL for direct import
  const sqlOutput = path.join(DB_DIR, "panchang_cache_seed.sql");
  const createTableSQL = `
-- Panchang Cache Seed Data
-- Generated on: ${new Date().toISOString()}

CREATE TABLE IF NOT EXISTS panchang_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  ayanamsa INTEGER NOT NULL DEFAULT 1,
  language TEXT NOT NULL DEFAULT 'en',
  response_data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_panchang_cache_lookup 
ON panchang_cache(date, latitude, longitude, ayanamsa, language);

CREATE INDEX IF NOT EXISTS idx_panchang_cache_access 
ON panchang_cache(last_accessed_at);

-- Seed Data
`;

  const insertStatements = seedData.map(row => 
    `INSERT INTO panchang_cache (cache_key, date, latitude, longitude, ayanamsa, language, response_data, created_at, updated_at, access_count, last_accessed_at) VALUES (${row.cache_key.map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v).join(', ')});`
  ).join('\n');

  fs.writeFileSync(sqlOutput, createTableSQL + '\n' + insertStatements);
  console.log(`[Seed] Exported SQL to: ${sqlOutput}`);

  // Print stats
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_entries,
      COUNT(DISTINCT date) as unique_dates,
      COUNT(DISTINCT language) as unique_languages
    FROM panchang_cache
  `).get();
  
  console.log("[Seed] Final stats:", stats);

  db.close();
  console.log("[Seed] Done!");
}

// Run if called directly
seed().catch(console.error);
