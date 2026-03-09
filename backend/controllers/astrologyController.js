import { HttpError } from "../utils/httpError.js";
import { prokeralaGet } from "../services/prokeralaService.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateCacheKey,
  getCachedPanchang,
  setCachedPanchang,
  getCacheStats,
} from "../services/panchangCacheService.js";

// Defaults are based on Prokerala's v2 API structure. Override per environment if needed.
const ENDPOINTS = {
  // Advanced kundli includes richer planet/house/dasha datasets useful for UI.
  kundali: process.env.PROKERALA_ENDPOINT_KUNDALI || "/astrology/kundli/advanced",
  // Prokerala's "Kundli Matching" endpoint. Use /advanced for more details.
  matchmaking: process.env.PROKERALA_ENDPOINT_MATCHMAKING || "/astrology/kundli-matching",
  muhurat: process.env.PROKERALA_ENDPOINT_MUHURAT || "/astrology/auspicious-period",
  panchang: process.env.PROKERALA_ENDPOINT_PANCHANG || "/astrology/panchang",
  panchangAdvanced: process.env.PROKERALA_ENDPOINT_PANCHANG_ADVANCED || "/astrology/panchang/advanced",
  choghadiya: process.env.PROKERALA_ENDPOINT_CHOGHADIYA || "/astrology/choghadiya",
  festivals: process.env.PROKERALA_ENDPOINT_FESTIVALS || "/astrology/festivals",
};

const ENABLE_PANCHANG_ADVANCED = String(process.env.PROKERALA_ENABLE_PANCHANG_ADVANCED || "false").toLowerCase() === "true";
const ENABLE_CHOGHADIYA = String(process.env.PROKERALA_ENABLE_CHOGHADIYA || "false").toLowerCase() === "true";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_FESTIVALS_DIR = path.resolve(__dirname, "../../frontend/public/data/festivals");
const LOCAL_PANCHANG_DIR = path.resolve(__dirname, "../../frontend/public/data");

function requireJsonBody(req) {
  if (!req.body || typeof req.body !== "object") {
    throw new HttpError(400, "Request body must be JSON.", { code: "INVALID_BODY" });
  }
}

function parseNumber(value, fieldName) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new HttpError(400, `Invalid ${fieldName}.`, { code: "INVALID_QUERY" });
  }
  return num;
}

function parseTzOffset(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new HttpError(400, "Invalid tzOffset. Expected a string like +05:30.", {
      code: "INVALID_BODY",
    });
  }
  const trimmed = value.trim();
  if (!/^[+-]\d{2}:\d{2}$/.test(trimmed)) {
    throw new HttpError(400, "Invalid tzOffset. Expected format +HH:MM or -HH:MM.", {
      code: "INVALID_BODY",
    });
  }
  return trimmed;
}

function parseAyanamsa(value) {
  // Prokerala: allowed values are 1, 3, 5.
  if (value == null || value === "") return 1;
  const num = Number(value);
  if (![1, 3, 5].includes(num)) {
    throw new HttpError(400, "Invalid ayanamsa. Allowed values are 1, 3, 5.", {
      code: "INVALID_BODY",
    });
  }
  return num;
}

function parseLanguage(value) {
  if (value == null || value === "") return "en";
  if (typeof value !== "string") {
    throw new HttpError(400, "Invalid la. Expected a string language code (e.g. en).", {
      code: "INVALID_BODY",
    });
  }
  return value.trim() || "en";
}

function buildCoordinates({ lat, lng }) {
  const latitude = parseNumber(lat, "lat");
  const longitude = parseNumber(lng, "lng");
  // Prokerala expects a string like "10.21,78.09". Keep a sane precision.
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

function buildIsoDatetime({ date, time, datetime, tzOffset }) {
  if (datetime) {
    if (typeof datetime !== "string") {
      throw new HttpError(400, "Invalid datetime. Expected ISO 8601 string.", {
        code: "INVALID_BODY",
      });
    }
    return datetime.trim();
  }

  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, "Missing/invalid date. Expected YYYY-MM-DD.", { code: "INVALID_BODY" });
  }

  const safeTime = time == null || time === "" ? "00:00:00" : String(time).trim();
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(safeTime)) {
    throw new HttpError(400, "Invalid time. Expected HH:MM or HH:MM:SS.", { code: "INVALID_BODY" });
  }
  const normalizedTime = safeTime.length === 5 ? `${safeTime}:00` : safeTime;

  const offset =
    parseTzOffset(tzOffset) || String(process.env.DEFAULT_TZ_OFFSET || "+05:30").trim();

  return `${date}T${normalizedTime}${offset}`;
}

/**
 * Shared Prokerala params used by many endpoints:
 * - datetime: ISO 8601 (with offset)
 * - coordinates: "lat,lng"
 * - ayanamsa: 1|3|5
 * - la: language (optional)
 */
function buildCommonParams(input) {
  const ayanamsa = parseAyanamsa(input.ayanamsa);
  const la = parseLanguage(input.la);

  const coordinates = input.coordinates
    ? String(input.coordinates).trim()
    : buildCoordinates({ lat: input.lat, lng: input.lng });

  const datetime = buildIsoDatetime({
    date: input.date,
    time: input.time,
    datetime: input.datetime,
    tzOffset: input.tzOffset,
  });

  return { ayanamsa, coordinates, datetime, la };
}

function extractPlanetPositions(payload) {
  const root = payload?.data || payload;
  if (!root || typeof root !== "object") return null;
  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.planet_positions)) return root.planet_positions;
  if (Array.isArray(root?.planet_position)) return root.planet_position;
  if (Array.isArray(root?.data)) return root.data;
  if (Array.isArray(root?.data?.planet_positions)) return root.data.planet_positions;
  if (Array.isArray(root?.data?.planet_position)) return root.data.planet_position;
  return null;
}

function isMissingUpstreamFestivalRoute(err) {
  if (!(err instanceof HttpError)) return false;
  if (err.statusCode !== 404 || err.code !== "PROKERALA_API_ERROR") return false;

  const payloadText = JSON.stringify(err.details?.providerPayload || "");
  return /No route found/i.test(payloadText);
}

async function loadLocalFestivals({ year, month }) {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return [];

  try {
    const filePath = path.join(LOCAL_FESTIVALS_DIR, `${year}.json`);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];

    const prefix = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-`;
    const out = [];

    for (const [dateKey, names] of Object.entries(parsed)) {
      if (!String(dateKey).startsWith(prefix) || !Array.isArray(names)) continue;
      names.forEach((name) => {
        if (name == null || name === "") return;
        out.push({ name: String(name), date: String(dateKey) });
      });
    }

    out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return out;
  } catch {
    return [];
  }
}

function extractTithiName(tithiText) {
  return String(tithiText || "").split(" upto ")[0].trim();
}

function extractPakshaName(pakshaText) {
  return String(pakshaText || "").replace(" Paksha", "").trim();
}

function getPradoshPrefix(weekday) {
  const map = {
    Monday: "Soma",
    Tuesday: "Bhauma",
    Wednesday: "Budha",
    Thursday: "Guru",
    Friday: "Shukra",
    Saturday: "Shani",
    Sunday: "Ravi",
  };
  return map[String(weekday || "").trim()] || "";
}

function inferFestivalsFromDay(day) {
  const out = [];
  const tithi = extractTithiName(day?.Tithi);
  const paksha = extractPakshaName(day?.Paksha);
  const weekday = String(day?.Weekday || "").trim();

  if (tithi === "Ekadashi") out.push("Ekadashi");
  if (tithi === "Trayodashi") {
    const pref = getPradoshPrefix(weekday);
    out.push(pref ? `${pref} Pradosh Vrat` : "Pradosh Vrat");
  }
  if (tithi === "Chaturthi" && paksha === "Krishna") out.push("Sankashti Chaturthi");
  if (tithi === "Purnima") out.push("Purnima");
  if (tithi === "Amavasya") out.push("Amavasya");
  if ((tithi === "Padyami" || tithi === "Pratipada") && paksha === "Shukla") {
    out.push("Chandra Darshana");
  }

  return out;
}

async function loadDerivedFestivals({ year, month }) {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return [];

  try {
    const filePath = path.join(LOCAL_PANCHANG_DIR, `${year}.json`);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return [];

    const out = [];
    parsed.forEach((day) => {
      const slashDate = String(day?.date || "");
      const [dd, mm, yyyy] = slashDate.split("/");
      if (!dd || !mm || !yyyy) return;
      if (Number(mm) !== month) return;

      const dateKey = `${yyyy}-${mm}-${dd}`;
      const names = inferFestivalsFromDay(day);
      names.forEach((name) => out.push({ name, date: dateKey }));
    });

    out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return out;
  } catch {
    return [];
  }
}

export async function kundali(req, res) {
  requireJsonBody(req);
  const params = buildCommonParams(req.body);

  const kundaliData = await prokeralaGet(ENDPOINTS.kundali, params);

  // Optional enrichments (never fail the main Kundali request if these hit 4xx/5xx).
  // This keeps the endpoint resilient across different Prokerala plans/products.
  const enrichments = await Promise.allSettled([
    prokeralaGet(ENDPOINTS.panchang, params),
    process.env.PROKERALA_ENDPOINT_PLANET_POSITIONS
      ? prokeralaGet(process.env.PROKERALA_ENDPOINT_PLANET_POSITIONS, params)
      : Promise.resolve(null),
  ]);

  const panchangData = enrichments[0].status === "fulfilled" ? enrichments[0].value : null;
  const planetPositionsData =
    enrichments[1].status === "fulfilled" ? enrichments[1].value : null;
  const planetPositionsArray = planetPositionsData ? extractPlanetPositions(planetPositionsData) : null;

  const merged = {
    ...kundaliData,
    data: {
      ...(kundaliData?.data || {}),
      ...(panchangData ? { panchang: panchangData?.data || panchangData } : {}),
      ...(planetPositionsData
        ? { planet_positions: planetPositionsArray || planetPositionsData?.data || planetPositionsData }
        : {}),
    },
  };

  res.json(merged);
}

export async function matchmaking(req, res) {
  requireJsonBody(req);

  const body = req.body || {};
  const ayanamsa = parseAyanamsa(body.ayanamsa);
  const la = parseLanguage(body.la);

  // Accept either { groom: {...}, bride: {...} } or { boy: {...}, girl: {...} }.
  const groom = body.groom || body.boy;
  const bride = body.bride || body.girl;

  if (!groom || !bride) {
    throw new HttpError(
      400,
      "Missing required fields: groom/bride (or boy/girl) birth details.",
      { code: "INVALID_BODY" }
    );
  }

  const boyDatetime = buildIsoDatetime({
    date: groom.date,
    time: groom.time,
    datetime: groom.datetime,
    tzOffset: groom.tzOffset || body.tzOffset,
  });
  const girlDatetime = buildIsoDatetime({
    date: bride.date,
    time: bride.time,
    datetime: bride.datetime,
    tzOffset: bride.tzOffset || body.tzOffset,
  });

  const boyCoordinates = groom.coordinates
    ? String(groom.coordinates).trim()
    : buildCoordinates({ lat: groom.lat, lng: groom.lng });
  const girlCoordinates = bride.coordinates
    ? String(bride.coordinates).trim()
    : buildCoordinates({ lat: bride.lat, lng: bride.lng });

  const isAdvanced = Boolean(body.advanced);
  const endpoint = isAdvanced ? `${ENDPOINTS.matchmaking}/advanced` : ENDPOINTS.matchmaking;

  const params = {
    ayanamsa,
    la,
    boy_dob: boyDatetime,
    girl_dob: girlDatetime,
    boy_coordinates: boyCoordinates,
    girl_coordinates: girlCoordinates,
  };

  const data = await prokeralaGet(endpoint, params);
  res.json(data);
}

export async function muhurat(req, res) {
  requireJsonBody(req);
  const params = buildCommonParams(req.body);
  const data = await prokeralaGet(ENDPOINTS.muhurat, params);
  res.json(data);
}

export async function panchang(req, res) {
  const { date, time, datetime, lat, lng, tzOffset, ayanamsa, la } = req.query;

  // Build the common params as before
  const params = buildCommonParams({
    date,
    time,
    datetime,
    lat,
    lng,
    tzOffset,
    ayanamsa,
    la,
  });

  // ============================================================
  // DATABASE CACHING LOGIC - Enterprise Production Implementation
  // ============================================================
  // 1. Generate cache key from request parameters
  // 2. Check if data exists in database cache
  // 3. If cached: return immediately without calling API
  // 4. If not cached: call API, store in DB, then return
  // ============================================================

  // Generate a unique cache key based on date, location, and settings
  const cacheKey = generateCacheKey({
    date: params.datetime?.split("T")[0] || date,
    coordinates: params.coordinates,
    latitude: lat,
    longitude: lng,
    ayanamsa: params.ayanamsa,
    language: params.la,
  });

  // Check cache TTL from environment (default: 30 days)
  const cacheTtlDays = Number(process.env.PANCHANG_CACHE_TTL_DAYS) || 30;
  const cacheTtlSeconds = cacheTtlDays * 24 * 60 * 60;

  // STEP 1: Try to get data from database cache
  const cachedData = getCachedPanchang(cacheKey, cacheTtlSeconds);

  if (cachedData) {
    // Cache hit! Return cached data immediately
    console.log(`[Panchang] Cache HIT for key: ${cacheKey} (age: ${cachedData.age}s, accesses: ${cachedData.accessCount})`);
    
    // Add cache metadata to response (useful for debugging/monitoring)
    return res.json({
      ...cachedData.data,
      _meta: {
        cached: true,
        cacheAge: cachedData.age,
        accessCount: cachedData.accessCount,
        cacheKey: cacheKey,
      },
    });
  }

  // Cache miss - need to call the API
  console.log(`[Panchang] Cache MISS for key: ${cacheKey} - calling Prokerala API`);

  const [baseResult, advancedResult, choghadiyaResult] = await Promise.allSettled([
    prokeralaGet(ENDPOINTS.panchang, params),
    ENABLE_PANCHANG_ADVANCED && ENDPOINTS.panchangAdvanced !== ENDPOINTS.panchang
      ? prokeralaGet(ENDPOINTS.panchangAdvanced, params)
      : Promise.resolve(null),
    ENABLE_CHOGHADIYA ? prokeralaGet(ENDPOINTS.choghadiya, params) : Promise.resolve(null),
  ]);

  if (baseResult.status !== "fulfilled") throw baseResult.reason;

  const baseData = baseResult.value?.data || baseResult.value || {};
  const advancedData =
    advancedResult.status === "fulfilled"
      ? (advancedResult.value?.data || advancedResult.value || {})
      : null;
  const choghadiyaData =
    choghadiyaResult.status === "fulfilled"
      ? (choghadiyaResult.value?.data || choghadiyaResult.value || {})
      : null;

  const merged = {
    ...(baseResult.value || {}),
    data: {
      ...baseData,
      ...(advancedData ? { advanced: advancedData } : {}),
      ...(Array.isArray(choghadiyaData?.muhurat) ? { choghadiya: choghadiyaData.muhurat } : {}),
    },
  };

  // STEP 2: Store the API response in database cache for future requests
  // This prevents future API calls for the same date/location
  const cacheStoreResult = setCachedPanchang(cacheKey, {
    date: params.datetime?.split("T")[0] || date,
    coordinates: params.coordinates,
    latitude: lat,
    longitude: lng,
    ayanamsa: params.ayanamsa,
    la: params.la,
  }, merged);

  if (cacheStoreResult) {
    console.log(`[Panchang] Successfully cached API response for key: ${cacheKey}`);
  } else {
    console.warn(`[Panchang] Failed to cache API response for key: ${cacheKey}`);
  }

  // Return the fresh data with metadata
  res.json({
    ...merged,
    _meta: {
      cached: false,
      cacheKey: cacheKey,
      cachedAt: new Date().toISOString(),
    },
  });
}

export async function festivals(req, res) {
  const { year, month, date, time, datetime, lat, lng, tzOffset, ayanamsa, la } = req.query;

  const y = year ? Number(year) : null;
  const m = month ? Number(month) : null;

  const safeYear = Number.isInteger(y) && y > 0 ? y : null;
  const safeMonth = Number.isInteger(m) && m >= 1 && m <= 12 ? m : null;

  const fallbackDate =
    safeYear && safeMonth
      ? `${String(safeYear).padStart(4, "0")}-${String(safeMonth).padStart(2, "0")}-01`
      : date;

  const common = buildCommonParams({
    date: fallbackDate,
    time,
    datetime,
    lat,
    lng,
    tzOffset,
    ayanamsa,
    la,
  });

  const params = {
    ...common,
    ...(safeYear ? { year: safeYear } : {}),
    ...(safeMonth ? { month: safeMonth } : {}),
  };

  try {
    const data = await prokeralaGet(ENDPOINTS.festivals, params);
    res.json(data);
  } catch (err) {
    if (isMissingUpstreamFestivalRoute(err)) {
      const fallbackYear = safeYear ?? Number(String(fallbackDate || "").slice(0, 4));
      const fallbackMonth = safeMonth ?? Number(String(fallbackDate || "").slice(5, 7));
      const localFestivals = await loadLocalFestivals({
        year: fallbackYear,
        month: fallbackMonth,
      });

      if (localFestivals.length) {
        return res.json({
          source: "local",
          data: {
            festivals: localFestivals,
          },
        });
      }

      const derivedFestivals = await loadDerivedFestivals({
        year: fallbackYear,
        month: fallbackMonth,
      });
      if (derivedFestivals.length) {
        return res.json({
          source: "derived",
          data: {
            festivals: derivedFestivals,
          },
        });
      }
    }

    throw err;
  }
}
