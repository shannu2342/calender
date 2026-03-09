function pad2(value) {
  return String(value).padStart(2, "0");
}

export function ymdToSlashDate(ymd) {
  const [year, month, day] = String(ymd || "").split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

export function slashDateToYmd(dateStr) {
  const [day, month, year] = String(dateStr || "").split("/");
  if (!day || !month || !year) return "";
  return `${year}-${month}-${day}`;
}

function parseClockTimeToMinutes(timeStr) {
  const input = String(timeStr || "").trim().toUpperCase();
  if (!input) return null;
  const match = input.match(/(\d{1,2})[:.](\d{2})\s*(AM|PM)?/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const marker = (match[3] || "").toUpperCase();
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  if (marker === "AM" && hours === 12) hours = 0;
  if (marker === "PM" && hours !== 12) hours += 12;
  return hours * 60 + minutes;
}

function localIsoFromMinutes(dateYmd, totalMinutes, tzOffset, dayOffset = 0) {
  const [y, m, d] = String(dateYmd || "").split("-").map(Number);
  if (![y, m, d].every(Number.isFinite)) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const utcMillis = Date.UTC(y, m - 1, d + dayOffset, hours, minutes, 0);
  const dt = new Date(utcMillis);
  const yyyy = dt.getUTCFullYear();
  const mm = pad2(dt.getUTCMonth() + 1);
  const dd = pad2(dt.getUTCDate());
  const hh = pad2(dt.getUTCHours());
  const min = pad2(dt.getUTCMinutes());
  const offset = String(tzOffset || "+05:30");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:00${offset}`;
}

function isoFromSingleTime(dateYmd, timeStr, tzOffset) {
  const mins = parseClockTimeToMinutes(timeStr);
  if (mins == null) return null;
  return localIsoFromMinutes(dateYmd, mins, tzOffset, 0);
}

function isoRangeFromTimes(dateYmd, startTime, endTime, tzOffset) {
  const startMin = parseClockTimeToMinutes(startTime);
  const endMin = parseClockTimeToMinutes(endTime);
  if (startMin == null || endMin == null) {
    return { start: null, end: null };
  }
  const dayShift = endMin < startMin ? 1 : 0;
  return {
    start: localIsoFromMinutes(dateYmd, startMin, tzOffset, 0),
    end: localIsoFromMinutes(dateYmd, endMin, tzOffset, dayShift),
  };
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function asText(value, fallback = "") {
  if (value == null) return fallback;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function sanitizeLabel(value) {
  const text = asText(value, "");
  if (!text) return "";
  if (/^\s*to\s+come\b/i.test(text)) return "";
  if (/to\s+come\s+after\s+deployment/i.test(text)) return "";
  if (/coming\s+soon/i.test(text)) return "";
  return text;
}

function toNameAndRange(value, dateYmd, tzOffset) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const name = String(value.name || "").trim();
    const startRaw = String(value.start || "").trim();
    const endRaw = String(value.end || "").trim();
    const range = isoRangeFromTimes(dateYmd, startRaw, endRaw, tzOffset);
    return { name, start: range.start, end: range.end };
  }
  return { name: String(value || "").trim(), start: null, end: null };
}

const yearCache = new Map();

export async function loadYearData(year, { signal } = {}) {
  const yr = Number(year);
  if (!Number.isFinite(yr)) return [];
  if (yearCache.has(yr)) return yearCache.get(yr);

  const res = await fetch(`/data/${yr}.json`, { signal });
  if (!res.ok) throw new Error(`Failed to load local year data (${yr})`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : [];
  yearCache.set(yr, list);
  return list;
}

export async function findLocalDayByYmd(ymd, { signal } = {}) {
  const [year] = String(ymd || "").split("-");
  const yearNum = Number(year);
  if (!Number.isFinite(yearNum)) return null;
  const list = await loadYearData(yearNum, { signal });
  const slash = ymdToSlashDate(ymd);
  return list.find((item) => item?.date === slash) || null;
}

export function normalizeDayRecord(day, { tzOffset = "+05:30" } = {}) {
  if (!day || typeof day !== "object") return null;
  const dateYmd = slashDateToYmd(day.date);
  if (!dateYmd) return { ...day };

  const tithi = toNameAndRange(day.Tithi, dateYmd, tzOffset);
  const nakshatra = toNameAndRange(day.Nakshatra, dateYmd, tzOffset);
  const yoga = toNameAndRange(day.Yoga, dateYmd, tzOffset);
  const karana = toNameAndRange(firstNonEmpty(day.Karana, day.Karanam), dateYmd, tzOffset);

  const tithiName = sanitizeLabel(tithi.name) || sanitizeLabel(day.Tithi);
  const nakshatraName = sanitizeLabel(nakshatra.name) || sanitizeLabel(day.Nakshatra);
  const yogaName = sanitizeLabel(yoga.name) || sanitizeLabel(day.Yoga);
  const karanaName = sanitizeLabel(karana.name) || sanitizeLabel(day.Karana) || sanitizeLabel(day.Karanam);

  return {
    ...day,
    Tithi: tithiName || "-",
    Nakshatra: nakshatraName || "-",
    Yoga: yogaName || "-",
    Karana: karanaName || "-",
    TithiStart: firstNonEmpty(day.TithiStart, tithi.start),
    TithiEnd: firstNonEmpty(day.TithiEnd, tithi.end),
    NakshatraStart: firstNonEmpty(day.NakshatraStart, nakshatra.start),
    NakshatraEnd: firstNonEmpty(day.NakshatraEnd, nakshatra.end),
    YogaStart: firstNonEmpty(day.YogaStart, yoga.start),
    YogaEnd: firstNonEmpty(day.YogaEnd, yoga.end),
    KaranaStart: firstNonEmpty(day.KaranaStart, karana.start),
    KaranaEnd: firstNonEmpty(day.KaranaEnd, karana.end),
    SunriseIso: firstNonEmpty(day.SunriseIso, isoFromSingleTime(dateYmd, day.Sunrise, tzOffset)),
    SunsetIso: firstNonEmpty(day.SunsetIso, isoFromSingleTime(dateYmd, day.Sunset, tzOffset)),
    MoonriseIso: firstNonEmpty(day.MoonriseIso, isoFromSingleTime(dateYmd, day.Moonrise, tzOffset)),
    MoonsetIso: firstNonEmpty(day.MoonsetIso, isoFromSingleTime(dateYmd, day.Moonset, tzOffset)),
  };
}

function splitRanges(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

function normalizeMinutes(minuteValue) {
  const total = Number(minuteValue);
  if (!Number.isFinite(total)) return { dayShift: 0, minutes: 0 };
  const dayShift = Math.floor(total / 1440);
  const minutes = ((total % 1440) + 1440) % 1440;
  return { dayShift, minutes };
}

function minutesToClockText(minuteValue) {
  const normalized = ((Math.floor(minuteValue) % 1440) + 1440) % 1440;
  let hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  const marker = hh >= 12 ? "PM" : "AM";
  hh = hh % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${pad2(mm)} ${marker}`;
}

function buildBrahmaMuhurtaEntry(dateYmd, sunrise, tzOffset) {
  const sunriseMinutes = parseClockTimeToMinutes(sunrise);
  if (sunriseMinutes == null) return null;

  const brahmaStart = sunriseMinutes - 84;
  const startNorm = normalizeMinutes(brahmaStart);
  const endNorm = normalizeMinutes(sunriseMinutes);

  const start = localIsoFromMinutes(dateYmd, startNorm.minutes, tzOffset, startNorm.dayShift);
  const end = localIsoFromMinutes(dateYmd, endNorm.minutes, tzOffset, endNorm.dayShift);
  if (!start || !end) return null;

  return {
    name: "Brahma Muhurta",
    type: "auspicious",
    start,
    end,
    time: `${minutesToClockText(brahmaStart)} to ${minutesToClockText(sunriseMinutes)}`,
  };
}

function toRangeEntry(dateYmd, label, rangeText, tzOffset, type) {
  const match = String(rangeText || "").match(
    /(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)\s*(?:to|-|->)\s*(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)/i
  );
  if (!match) return null;
  const range = isoRangeFromTimes(dateYmd, match[1], match[2], tzOffset);
  if (!range.start || !range.end) return null;
  return {
    name: label,
    type,
    start: range.start,
    end: range.end,
    time: `${match[1]} to ${match[2]}`,
  };
}

export function buildLocalPanchangPayload(dayInput, { date, tzOffset = "+05:30" } = {}) {
  const day = normalizeDayRecord(dayInput, { tzOffset });
  if (!day) return { status: "error", error: "Local data not available" };
  const dateYmd = date || slashDateToYmd(day.date);
  const startOfDay = `${dateYmd}T00:00:00${tzOffset}`;
  const endOfDay = `${dateYmd}T23:59:59${tzOffset}`;

  const tithiStart = day.TithiStart || startOfDay;
  const tithiEnd = day.TithiEnd || endOfDay;
  const nakshatraStart = day.NakshatraStart || startOfDay;
  const nakshatraEnd = day.NakshatraEnd || endOfDay;
  const yogaStart = day.YogaStart || startOfDay;
  const yogaEnd = day.YogaEnd || endOfDay;
  const karanaStart = day.KaranaStart || startOfDay;
  const karanaEnd = day.KaranaEnd || endOfDay;

  return {
    status: "ok",
    source: "local-json",
    data: {
      vaara: day.Weekday || "-",
      sunrise: day.SunriseIso || startOfDay,
      sunset: day.SunsetIso || endOfDay,
      moonrise: day.MoonriseIso || startOfDay,
      moonset: day.MoonsetIso || endOfDay,
      paksha: day.Paksha || "-",
      tithi: [{ name: day.Tithi || "-", paksha: day.Paksha || "-", start: tithiStart, end: tithiEnd }],
      nakshatra: [{ name: day.Nakshatra || "-", start: nakshatraStart, end: nakshatraEnd }],
      yoga: [{ name: day.Yoga || "-", start: yogaStart, end: yogaEnd }],
      karana: [{ name: day.Karana || "-", start: karanaStart, end: karanaEnd }],
      lunar_month: day["Lunar Month"] ? { name: day["Lunar Month"] } : null,
      samvatsara: day["Shaka Samvat"] ? { name: day["Shaka Samvat"] } : null,
      advanced: {},
    },
  };
}

export function buildLocalMuhuratPayload(dayInput, { date, tzOffset = "+05:30" } = {}) {
  const day = normalizeDayRecord(dayInput, { tzOffset });
  if (!day) return { status: "error", error: "Local data not available" };
  const dateYmd = date || slashDateToYmd(day.date);

  const inauspicious = [
    ["Rahu Kalam", day["Rahu Kalam"]],
    ["Yamaganda", day.Yamaganda],
    ["Gulikai Kalam", day["Gulikai Kalam"]],
    ["Dur Muhurtam", day["Dur Muhurtam"]],
    ["Varjyam", day.Varjyam],
  ];
  const auspicious = [
    ["Abhijit", day.Abhijit],
    ["Amrit Kalam", day["Amrit Kalam"]],
  ];

  const periods = [];
  for (const [label, value] of inauspicious) {
    for (const rangeText of splitRanges(value)) {
      const entry = toRangeEntry(dateYmd, label, rangeText, tzOffset, "inauspicious");
      if (entry) periods.push(entry);
    }
  }
  for (const [label, value] of auspicious) {
    for (const rangeText of splitRanges(value)) {
      const entry = toRangeEntry(dateYmd, label, rangeText, tzOffset, "auspicious");
      if (entry) periods.push(entry);
    }
  }

  const brahmaMuhurta = buildBrahmaMuhurtaEntry(dateYmd, day.Sunrise, tzOffset);
  if (brahmaMuhurta) periods.push(brahmaMuhurta);

  return {
    status: "ok",
    source: "local-json",
    data: {
      periods,
    },
  };
}
