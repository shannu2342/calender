import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path - stored in backend/data directory for persistence
const DB_DIR = path.resolve(__dirname, "../data");
const DB_PATH = path.join(DB_DIR, "panchang_cache.db");
const SEED_FILE = path.join(DB_DIR, "panchang_cache_seed.json");

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database connection
let db = null;

/**
 * Initialize the database connection and create tables if they don't exist.
 * This is called once at application startup.
 * 
 * @param {boolean} skipSeedLoad - If true, skip loading seed data (for maintenance)
 */
export function initDatabase(skipSeedLoad = false) {
  if (db) {
    return db;
  }

  try {
    db = new Database(DB_PATH, {
      // Enable WAL mode for better concurrent read/write performance
      // This is crucial for scalability with 1 lakh users
      verbose: process.env.DB_VERBOSE_LOGGING === "true" ? console.log : null,
    });

    // Enable WAL mode for better concurrent performance
    db.pragma("journal_mode = WAL");
    
    // Optimize for concurrent reads
    db.pragma("read_uncommitted = 1");
    
    // Create the panchang cache table
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

    console.log(`[Database] Initialized at: ${DB_PATH}`);
    console.log(`[Database] WAL mode enabled for concurrent access`);
    
    // Load seed data if database is empty and seed file exists
    if (!skipSeedLoad) {
      loadSeedDataIfEmpty();
    }
    
    return db;
  } catch (error) {
    console.error("[Database] Failed to initialize:", error);
    throw error;
  }
}

/**
 * Load seed data if database is empty and seed file exists.
 * This is used for pre-populating cache in production.
 */
function loadSeedDataIfEmpty() {
  try {
    // Check if database has any entries
    const countStmt = db.prepare("SELECT COUNT(*) as count FROM panchang_cache");
    const { count } = countStmt.get();
    
    if (count > 0) {
      console.log(`[Database] Cache already has ${count} entries, skipping seed load`);
      return;
    }
    
    // Check if seed file exists
    if (!fs.existsSync(SEED_FILE)) {
      console.log(`[Database] No seed file found at ${SEED_FILE}, skipping seed load`);
      return;
    }
    
    console.log(`[Database] Loading seed data from ${SEED_FILE}...`);
    const seedData = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
    
    if (!Array.isArray(seedData) || seedData.length === 0) {
      console.log("[Database] Seed file is empty, skipping");
      return;
    }
    
    // Insert seed data
    const insertStmt = db.prepare(`
      INSERT INTO panchang_cache (
        cache_key, date, latitude, longitude, ayanamsa, language, 
        response_data, created_at, updated_at, access_count, last_accessed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((entries) => {
      for (const entry of entries) {
        insertStmt.run(
          entry.cache_key,
          entry.date,
          entry.latitude,
          entry.longitude,
          entry.ayanamsa,
          entry.language,
          entry.response_data,
          entry.created_at,
          entry.updated_at,
          entry.access_count,
          entry.last_accessed_at
        );
      }
    });
    
    insertMany(seedData);
    console.log(`[Database] Loaded ${seedData.length} seed entries`);
    
  } catch (error) {
    console.error("[Database] Error loading seed data:", error.message);
    // Don't throw - just continue without seed data
  }
}

/**
 * Get the database instance. Initializes if not already done.
 */
export function getDatabase() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Generate a consistent cache key from request parameters.
 * This ensures same date/location always produces the same key.
 * 
 * @param {Object} params - Request parameters
 * @returns {string} Cache key
 */
export function generateCacheKey(params) {
  const { date, latitude, longitude, ayanamsa = 1, language = "en" } = params;
  
  // Round coordinates to 4 decimal places for consistent matching
  const lat = Number(latitude).toFixed(4);
  const lng = Number(longitude).toFixed(4);
  
  // Normalize date to YYYY-MM-DD
  const normalizedDate = date instanceof Date 
    ? date.toISOString().split("T")[0] 
    : String(date).split("T")[0];
  
  return `panchang:${normalizedDate}:${lat},${lng}:${ayanamsa}:${language}`;
}

/**
 * Retrieve cached panchang data if it exists and is not expired.
 * 
 * @param {string} cacheKey - The cache key to look up
 * @param {number} cacheTtlSeconds - TTL in seconds (default: 30 days)
 * @returns {Object|null} Cached data or null if not found/expired
 */
export function getCachedPanchang(cacheKey, cacheTtlSeconds = 30 * 24 * 60 * 60) {
  const database = getDatabase();
  
  try {
    const stmt = database.prepare(`
      SELECT response_data, created_at, access_count 
      FROM panchang_cache 
      WHERE cache_key = ?
    `);
    
    const row = stmt.get(cacheKey);
    
    if (!row) {
      return null;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const age = now - row.created_at;
    
    // Check if cache has expired
    if (age > cacheTtlSeconds) {
      // Optionally delete expired entry
      deleteCachedPanchang(cacheKey);
      return null;
    }
    
    // Update access statistics for monitoring
    const updateStmt = database.prepare(`
      UPDATE panchang_cache 
      SET access_count = access_count + 1, 
          last_accessed_at = strftime('%s', 'now')
      WHERE cache_key = ?
    `);
    updateStmt.run(cacheKey);
    
    return {
      data: JSON.parse(row.response_data),
      fromCache: true,
      age: age,
      accessCount: row.access_count + 1,
    };
  } catch (error) {
    console.error("[Database] Error retrieving cache:", error);
    return null;
  }
}

/**
 * Store panchang data in the cache.
 * 
 * @param {string} cacheKey - Unique cache key
 * @param {Object} params - Original request parameters
 * @param {Object} responseData - API response data to cache
 * @returns {boolean} Success status
 */
export function setCachedPanchang(cacheKey, params, responseData) {
  const database = getDatabase();
  
  try {
    // Parse latitude and longitude from the coordinates string if needed
    let latitude, longitude;
    if (params.coordinates) {
      const [lat, lng] = params.coordinates.split(",");
      latitude = parseFloat(lat);
      longitude = parseFloat(lng);
    } else {
      latitude = parseFloat(params.latitude);
      longitude = parseFloat(params.longitude);
    }
    
    const date = params.date || params.datetime?.split("T")[0];
    const ayanamsa = params.ayanamsa || 1;
    const language = params.la || params.language || "en";
    
    const stmt = database.prepare(`
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
      latitude,
      longitude,
      ayanamsa,
      language,
      JSON.stringify(responseData)
    );
    
    console.log(`[Database] Cached panchang data for key: ${cacheKey}`);
    return true;
  } catch (error) {
    console.error("[Database] Error caching data:", error);
    return false;
  }
}

/**
 * Delete a specific cache entry.
 * 
 * @param {string} cacheKey - Cache key to delete
 * @returns {boolean} Success status
 */
export function deleteCachedPanchang(cacheKey) {
  const database = getDatabase();
  
  try {
    const stmt = database.prepare("DELETE FROM panchang_cache WHERE cache_key = ?");
    stmt.run(cacheKey);
    return true;
  } catch (error) {
    console.error("[Database] Error deleting cache:", error);
    return false;
  }
}

/**
 * Clean up old cache entries to prevent database bloat.
 * Should be called periodically (e.g., daily via cron).
 * 
 * @param {number} maxAgeSeconds - Maximum age in seconds (default: 90 days)
 * @returns {number} Number of entries deleted
 */
export function cleanupOldCache(maxAgeSeconds = 90 * 24 * 60 * 60) {
  const database = getDatabase();
  
  try {
    const cutoffTime = Math.floor(Date.now() / 1000) - maxAgeSeconds;
    
    // First get count of entries to be deleted
    const countStmt = database.prepare(`
      SELECT COUNT(*) as count FROM panchang_cache 
      WHERE last_accessed_at < ?
    `);
    const { count } = countStmt.get(cutoffTime);
    
    if (count > 0) {
      const deleteStmt = database.prepare(`
        DELETE FROM panchang_cache WHERE last_accessed_at < ?
      `);
      deleteStmt.run(cutoffTime);
      console.log(`[Database] Cleaned up ${count} expired cache entries`);
    }
    
    return count;
  } catch (error) {
    console.error("[Database] Error cleaning up cache:", error);
    return 0;
  }
}

/**
 * Get cache statistics for monitoring.
 * 
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  const database = getDatabase();
  
  try {
    const stmt = database.prepare(`
      SELECT 
        COUNT(*) as total_entries,
        SUM(access_count) as total_accesses,
        MIN(created_at) as oldest_entry,
        MAX(last_accessed_at) as latest_access
      FROM panchang_cache
    `);
    
    const stats = stmt.get();
    
    // Calculate database size
    const sizeStmt = database.prepare(`
      SELECT page_count * page_size as size 
      FROM pragma_page_count(), pragma_page_size()
    `);
    const { size } = sizeStmt.get();
    
    return {
      totalEntries: stats.total_entries || 0,
      totalAccesses: stats.total_accesses || 0,
      oldestEntry: stats.oldest_entry ? new Date(stats.oldest_entry * 1000) : null,
      latestAccess: stats.latest_access ? new Date(stats.latest_access * 1000) : null,
      databaseSizeBytes: size || 0,
      databaseSizeMB: ((size || 0) / (1024 * 1024)).toFixed(2),
    };
  } catch (error) {
    console.error("[Database] Error getting stats:", error);
    return null;
  }
}

/**
 * Close the database connection.
 * Should be called on application shutdown.
 */
export function closeDatabase() {
  if (db) {
    try {
      db.close();
      console.log("[Database] Connection closed");
      db = null;
    } catch (error) {
      console.error("[Database] Error closing connection:", error);
    }
  }
}

export default {
  initDatabase,
  getDatabase,
  generateCacheKey,
  getCachedPanchang,
  setCachedPanchang,
  deleteCachedPanchang,
  cleanupOldCache,
  getCacheStats,
  closeDatabase,
};
