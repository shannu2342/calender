export function ymdToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeTime(value) {
  const t = String(value || "").trim();
  if (!t) return "00:00";
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t.slice(0, 5);
  return "00:00";
}

export function buildIsoDatetime({ date, time, tzOffset }) {
  const safeDate = String(date || ymdToday()).trim();
  const safeTime = normalizeTime(time);
  const safeOffset = String(tzOffset || "+05:30").trim();
  return `${safeDate}T${safeTime}:00${safeOffset}`;
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function readPath(obj, path) {
  if (!obj || typeof obj !== "object") return null;
  const parts = String(path).split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object" || !(part in cur)) return null;
    cur = cur[part];
  }
  return cur;
}

export function periodStart(item) {
  return firstNonEmpty([
    item?.start,
    item?.start_at,
    item?.from,
    item?.begin,
    item?.start_time,
    item?.startTime,
    readPath(item, "period.0.start"),
    readPath(item, "period.0.start_at"),
    readPath(item, "periods.0.start"),
    readPath(item, "periods.0.start_at"),
    readPath(item, "datetime.start"),
    readPath(item, "datetime.start_at"),
    readPath(item, "date_time.start"),
    readPath(item, "timings.start"),
    readPath(item, "time.start"),
  ]);
}

export function periodEnd(item) {
  return firstNonEmpty([
    item?.end,
    item?.end_at,
    item?.to,
    item?.finish,
    item?.end_time,
    item?.endTime,
    readPath(item, "period.0.end"),
    readPath(item, "period.0.end_at"),
    readPath(item, "periods.0.end"),
    readPath(item, "periods.0.end_at"),
    readPath(item, "datetime.end"),
    readPath(item, "datetime.end_at"),
    readPath(item, "date_time.end"),
    readPath(item, "timings.end"),
    readPath(item, "time.end"),
  ]);
}

export function isoParts(iso) {
  const raw =
    typeof iso === "object"
      ? firstNonEmpty([iso?.datetime, iso?.date_time, iso?.time, periodStart(iso), periodEnd(iso)])
      : iso;
  const s = String(raw || "");
  if (!s) return { date: "-", time: "-" };
  if (s.includes("T") && s.length >= 16) return { date: s.slice(0, 10), time: s.slice(11, 16) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { date: s, time: "-" };
  if (/^\d{2}:\d{2}/.test(s)) return { date: "-", time: s.slice(0, 5) };
  return { date: "-", time: s };
}

export function safeDateFromIso(iso) {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function findActiveByTime(list, refDate) {
  if (!Array.isArray(list) || !list.length || !refDate) return null;
  const refMs = refDate.getTime();
  for (const item of list) {
    const start = safeDateFromIso(periodStart(item));
    const end = safeDateFromIso(periodEnd(item));
    if (!start || !end) continue;
    if (refMs >= start.getTime() && refMs < end.getTime()) return item;
  }
  return list[0] || null;
}

export function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}
