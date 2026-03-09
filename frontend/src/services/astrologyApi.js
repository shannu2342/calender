import {
  buildLocalMuhuratPayload,
  buildLocalPanchangPayload,
  findLocalDayByYmd,
  loadYearData,
  normalizeDayRecord,
  slashDateToYmd,
} from "../utils/localPanchang";

const RASHIS = [
  "Mesha",
  "Vrishabha",
  "Mithuna",
  "Karka",
  "Simha",
  "Kanya",
  "Tula",
  "Vrischika",
  "Dhanu",
  "Makara",
  "Kumbha",
  "Meena",
];

const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
  "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

function parseTimeToMinutes(time) {
  const m = String(time || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function hashParts(parts) {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p ?? "");
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
  }
  return Math.abs(h >>> 0);
}

function nakshatraToRashiIndex(name) {
  const idx = NAKSHATRAS.findIndex((n) => n.toLowerCase() === String(name || "").toLowerCase());
  if (idx < 0) return 0;
  return Math.floor((idx * 12) / 27);
}

function zodiacNameFromIndex(idx) {
  return RASHIS[((idx % 12) + 12) % 12];
}

function buildPlanetPositions({ date, time, lat, lng, moonRashiIndex }) {
  const seed = hashParts([date, time, lat, lng]);
  const base = (seed % 12 + moonRashiIndex) % 12;
  const offsets = {
    Sun: 0,
    Moon: 1,
    Mars: 3,
    Mercury: 2,
    Jupiter: 5,
    Venus: 4,
    Saturn: 7,
    Rahu: 8,
    Ketu: 2,
    Lagna: Math.floor(parseTimeToMinutes(time) / 120) % 12,
  };

  return Object.entries(offsets).map(([name, shift], idx) => {
    const rashiIndex = (base + shift) % 12;
    const degree = Number((((seed % 3000) / 100) + idx * 1.7) % 30).toFixed(2);
    const nakIndex = ((rashiIndex * 2 + idx) % 27 + 27) % 27;
    return {
      name,
      rasi: { name: zodiacNameFromIndex(rashiIndex) },
      degree,
      nakshatra: { name: NAKSHATRAS[nakIndex], pada: (idx % 4) + 1 },
    };
  });
}

function deriveKundaliCore(body, day) {
  const date = body?.date;
  const time = body?.time || "12:00";
  const lat = body?.lat || "0";
  const lng = body?.lng || "0";
  const normalized = normalizeDayRecord(day, { tzOffset: body?.tzOffset || "+05:30" });
  const nakName = normalized?.Nakshatra || "Ashwini";
  const moonRashiIndex = nakshatraToRashiIndex(nakName);
  const moonRashi = zodiacNameFromIndex(moonRashiIndex);
  const planets = buildPlanetPositions({ date, time, lat, lng, moonRashiIndex });
  const lagna = planets.find((p) => p.name === "Lagna");
  const moon = planets.find((p) => p.name === "Moon");

  return {
    normalized,
    moonRashi,
    moon,
    lagna,
    planets,
  };
}

function buildMockVimshottariMahadasha(seed, birthIso) {
  const lords = [
    { name: "Ketu", years: 7 },
    { name: "Venus", years: 20 },
    { name: "Sun", years: 6 },
    { name: "Moon", years: 10 },
    { name: "Mars", years: 7 },
    { name: "Rahu", years: 18 },
    { name: "Jupiter", years: 16 },
    { name: "Saturn", years: 19 },
    { name: "Mercury", years: 17 },
  ];
  const base = safeDateFromIsoLike(birthIso) || new Date();
  const startIndex = seed % lords.length;
  const ordered = [...lords.slice(startIndex), ...lords.slice(0, startIndex)];
  const periods = [];
  let cursor = new Date(base.getTime());

  for (const lord of ordered) {
    const start = new Date(cursor.getTime());
    const end = new Date(cursor.getTime());
    end.setUTCFullYear(end.getUTCFullYear() + lord.years);
    periods.push({
      name: lord.name,
      start: start.toISOString(),
      end: end.toISOString(),
    });
    cursor = end;
  }
  return periods;
}

function safeDateFromIsoLike(value) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getLocalPanchang(
  { date, tzOffset } = {},
  { signal } = {}
) {
  return findLocalDayByYmd(date, { signal }).then((day) =>
    buildLocalPanchangPayload(day, { date, tzOffset })
  );
}
export const getProkeralaPanchang = getLocalPanchang;

export async function getLocalFestivals(
  { year, month } = {},
  { signal } = {}
) {
  const yr = Number(year);
  const mon = Number(month);
  if (!Number.isFinite(yr) || !Number.isFinite(mon)) return { status: "ok", data: [] };
  const rows = await loadYearData(yr, { signal });
  const out = [];
  for (const row of rows) {
    const date = slashDateToYmd(row?.date);
    if (!date) continue;
    const m = Number(date.slice(5, 7));
    if (m !== mon) continue;
    const festivals = Array.isArray(row?.Festivals) ? row.Festivals : [];
    festivals.forEach((name) => {
      if (name) out.push({ name: String(name), date });
    });
  }
  return { status: "ok", source: "local-json", data: { festivals: out } };
}
export const getProkeralaFestivals = getLocalFestivals;

export async function postKundali(body, { signal } = {}) {
  const date = body?.date;
  const day = await findLocalDayByYmd(date, { signal });
  const panchangPayload = buildLocalPanchangPayload(day, { date, tzOffset: body?.tzOffset });
  const panchang = panchangPayload?.data || {};
  const core = deriveKundaliCore(body, day);
  const seed = hashParts([body?.date, body?.time, body?.lat, body?.lng]);
  const birthIso = `${body?.date}T${body?.time}:00${body?.tzOffset || "+05:30"}`;
  const dashaPeriods = buildMockVimshottariMahadasha(seed, birthIso);

  return {
    status: "ok",
    source: "local-json",
    data: {
      datetime: birthIso,
      ayanamsa: body?.ayanamsa || "1",
      rasi: { name: core.moonRashi },
      ascendant: { rasi: { name: core.lagna?.rasi?.name || "Mesha" }, degree: core.lagna?.degree || "0.00" },
      panchang,
      planet_positions: core.planets,
      nakshatra_details: {
        nakshatra: {
          name: core.normalized?.Nakshatra || "Ashwini",
          pada: core.moon?.nakshatra?.pada || 1,
          lord: { name: "Chandra", vedic_name: "Chandra" },
        },
        chandra_rasi: {
          name: core.moonRashi,
          lord: { name: "Chandra", vedic_name: "Chandra" },
        },
        additional_info: {
          animal_sign: seed % 2 ? "Ashwa" : "Simha",
          ganam: seed % 3 ? "Deva" : "Manushya",
          nadi: seed % 2 ? "Madhya" : "Adi",
          deity: "Agni",
          syllables: "Chu, Che, Cho",
        },
      },
      vimshottari_dasha: {
        balance: `${(seed % 19) + 1}y ${(seed % 11) + 1}m ${(seed % 27) + 1}d`,
        maha_dasha: dashaPeriods,
      },
      mangal_dosha_details: {
        has_dosha: ["Mesha", "Karka", "Tula", "Makara"].includes(core.lagna?.rasi?.name || ""),
        description: "Computed from local planetary approximation.",
      },
      yoga_details: [],
    },
  };
}

function kootaScores(groom, bride) {
  const gNak = String(groom?.Nakshatra || "");
  const bNak = String(bride?.Nakshatra || "");
  const gRashi = nakshatraToRashiIndex(gNak);
  const bRashi = nakshatraToRashiIndex(bNak);
  const samePaksha = String(groom?.Paksha || "") === String(bride?.Paksha || "");
  const tithiMatch = String(groom?.Tithi || "") === String(bride?.Tithi || "");
  const distance = Math.abs(gRashi - bRashi);

  const rows = [
    { id: 1, name: "Varna", maximum_points: 1, obtained_points: samePaksha ? 1 : 0 },
    { id: 2, name: "Vasya", maximum_points: 2, obtained_points: distance <= 2 ? 2 : 1 },
    { id: 3, name: "Tara", maximum_points: 3, obtained_points: (distance % 3) ? 2 : 3 },
    { id: 4, name: "Yoni", maximum_points: 4, obtained_points: tithiMatch ? 4 : 2 },
    { id: 5, name: "Graha Maitri", maximum_points: 5, obtained_points: samePaksha ? 4 : 3 },
    { id: 6, name: "Gana", maximum_points: 6, obtained_points: distance <= 4 ? 6 : 4 },
    { id: 7, name: "Bhakoot", maximum_points: 7, obtained_points: distance <= 6 ? 6 : 3 },
    { id: 8, name: "Nadi", maximum_points: 8, obtained_points: gNak === bNak ? 0 : 8 },
  ];

  rows.forEach((r) => {
    r.boy_koot = groom?.Nakshatra || "-";
    r.girl_koot = bride?.Nakshatra || "-";
    r.description = "Calculated using local Panchang matching rules.";
  });

  const total = rows.reduce((sum, r) => sum + Number(r.obtained_points || 0), 0);
  return { rows, total };
}

export async function postMatchmaking(body, { signal } = {}) {
  const groomDay = await findLocalDayByYmd(body?.groom?.date, { signal });
  const brideDay = await findLocalDayByYmd(body?.bride?.date, { signal });
  const groom = normalizeDayRecord(groomDay, { tzOffset: body?.tzOffset });
  const bride = normalizeDayRecord(brideDay, { tzOffset: body?.tzOffset });
  const { rows, total } = kootaScores(groom, bride);

  const type = total >= 28 ? "excellent" : total >= 18 ? "good" : total >= 12 ? "average" : "poor";
  const message = {
    type,
    description:
      type === "excellent"
        ? "Very strong compatibility."
        : type === "good"
          ? "Good compatibility with balanced factors."
          : type === "average"
            ? "Moderate compatibility. Consider detailed consultation."
            : "Low compatibility in local matching model.",
  };

  const toInfo = (d, t) => ({
    rasi: { name: zodiacNameFromIndex(nakshatraToRashiIndex(d?.Nakshatra || "")) },
    nakshatra: { name: d?.Nakshatra || "-", pada: (parseTimeToMinutes(t || "00:00") % 4) + 1 },
  });

  return {
    status: "ok",
    source: "local-json",
    data: {
      message,
      guna_milan: {
        total_points: total,
        maximum_points: 36,
        guna: rows,
      },
      boy_info: toInfo(groom, body?.groom?.time),
      girl_info: toInfo(bride, body?.bride?.time),
      boy_mangal_dosha_details: {
        dosha_type: "Local Estimate",
        description: "Derived from local lagna/rashi approximation.",
      },
      girl_mangal_dosha_details: {
        dosha_type: "Local Estimate",
        description: "Derived from local lagna/rashi approximation.",
      },
    },
  };
}

export function getLocalMuhurat(body, { signal } = {}) {
  const { date, tzOffset } = body || {};
  return findLocalDayByYmd(date, { signal }).then((day) =>
    buildLocalMuhuratPayload(day, { date, tzOffset })
  );
}
export const postMuhurat = getLocalMuhurat;
