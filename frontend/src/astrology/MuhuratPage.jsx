import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { postMuhurat } from "../services/astrologyApi";
import { getAstroDefaults } from "../utils/appSettings";
import PageShell from "../pages/PageShell";
import { Field, JsonBlock, SectionCard, SelectInput, TextInput } from "./components/AstroInputs";
import { buildIsoDatetime, isoParts, periodEnd, periodStart, safeDateFromIso, ymdToday } from "./components/formatters";
import CalendarDateInput from "../components/CalendarDateInput";

function findPeriodList(root) {
  const data = root?.data || root;
  const candidates = [
    data?.periods,
    data?.auspicious_periods,
    data?.auspiciousPeriods,
    data?.muhurat,
    data?.muhurta,
    data?.data?.periods,
    data?.data?.auspicious_periods,
  ];

  const toArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") {
      return Object.entries(value).map(([key, val]) => ({
        ...(val && typeof val === "object" ? val : { value: val }),
        __key: key,
      }));
    }
    return [];
  };

  for (const c of candidates) {
    const arr = toArray(c);
    if (arr.length) return arr;
  }

  // Some Prokerala responses are a map of periods under data itself.
  if (data && typeof data === "object") {
    const asArr = toArray(data);
    if (asArr.length) return asArr;
  }

  return [];
}

function normalizePeriod(p) {
  const asTimeString = (value) => (typeof value === "string" ? value : null);

  const rawName = p?.name || p?.title || p?.type || p?.__key || "-";
  const name = String(rawName).replace(/_/g, " ");
  const start =
    asTimeString(periodStart(p)) ||
    null;
  const end =
    asTimeString(periodEnd(p)) ||
    null;

  const range =
    typeof p?.time === "string"
      ? p.time
      : typeof p?.timing === "string"
        ? p.timing
        : typeof p?.value === "string"
          ? p.value
          : null;
  const rangeMatch =
    range &&
    range.match(
      /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:to|-|→)\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i
    );
  const start2 = !start && rangeMatch ? rangeMatch[1] : null;
  const end2 = !end && rangeMatch ? rangeMatch[2] : null;
  const description = p?.description || p?.summary || p?.note || null;
  return { name, type: p?.type || null, start: start || start2, end: end || end2, description, raw: p };
}

function classifyPeriodType(period) {
  const typeText = String(period?.type || "").toLowerCase();
  if (typeText.includes("ausp")) return "auspicious";
  if (typeText.includes("inausp") || typeText.includes("malefic")) return "inauspicious";

  const name = String(period?.name || "").toLowerCase();
  if (/(rahu|yamag|gulik|durmuh|dur\s*muh|varjy|varjya)/i.test(name)) return "inauspicious";
  if (/(abhijit|amrit|brahma|vijaya|godhuli)/i.test(name)) return "auspicious";
  return "other";
}

function pickCurrentAndNext(periods, refDate) {
  if (!Array.isArray(periods) || !periods.length || !refDate) return { current: null, next: null };
  const refMs = refDate.getTime();
  let next = null;
  for (const p of periods) {
    const s = safeDateFromIso(periodStart(p));
    const e = safeDateFromIso(periodEnd(p));
    if (!s || !e) continue;
    const sMs = s.getTime();
    const eMs = e.getTime();
    if (refMs >= sMs && refMs < eMs) return { current: p, next: null };
    if (sMs > refMs) {
      const nextStart = safeDateFromIso(periodStart(next));
      const nextStartMs = nextStart ? nextStart.getTime() : Infinity;
      if (!next || sMs < nextStartMs) next = p;
    }
  }
  return { current: null, next };
}

export default function MuhuratPage() {
  const abortRef = useRef(null);
  const [showRaw, setShowRaw] = useState(false);
  const [form, setForm] = useState(() => ({
    date: ymdToday(),
    time: "08:00",
    ...getAstroDefaults(),
  }));

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const periods = useMemo(
    () =>
      findPeriodList(result)
        .map(normalizePeriod)
        .filter((p) => p && (p.start || p.end)),
    [result]
  );
  const refDate = useMemo(
    () =>
      safeDateFromIso(
        buildIsoDatetime({
          date: form.date,
          time: form.time,
          tzOffset: form.tzOffset,
        })
      ),
    [form.date, form.time, form.tzOffset]
  );
  const spotlight = useMemo(() => pickCurrentAndNext(periods, refDate), [periods, refDate]);
  const auspiciousPeriods = useMemo(
    () => periods.filter((p) => classifyPeriodType(p) === "auspicious"),
    [periods]
  );
  const inauspiciousPeriods = useMemo(
    () => periods.filter((p) => classifyPeriodType(p) === "inauspicious"),
    [periods]
  );
  const otherPeriods = useMemo(
    () => periods.filter((p) => classifyPeriodType(p) === "other"),
    [periods]
  );

  const fmtTime = (value) => {
    const s = String(value ?? "").trim();
    if (!s || s === "null" || s === "undefined") return "---";
    if (s.includes("T")) return isoParts(s).time;
    return s;
  };

  const onChange = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }));

  const runFetch = async ({ signal } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await postMuhurat({
        date: form.date,
        time: form.time,
        lat: form.lat,
        lng: form.lng,
        tzOffset: form.tzOffset,
        ayanamsa: form.ayanamsa,
        la: form.la,
      }, { signal });
      setResult(payload);
    } catch (err) {
      if (err?.name === "AbortError") return;
      setError(err?.payload || { message: err?.message || "Request failed" });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;
    await runFetch({ signal: controller.signal });
  };

  useEffect(() => {
    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;
    const t = setTimeout(() => runFetch({ signal: controller.signal }), 550);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, form.time, form.lat, form.lng, form.tzOffset, form.ayanamsa, form.la]);

  return (
    <PageShell
      title="Muhurat"
      right={
        <Link
          to="/settings"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-amber-100 ring-1 ring-white/10 hover:bg-white/10"
          aria-label="Settings"
          title="Settings"
        >
          ⚙
        </Link>
      }
    >
      <div className="grid gap-6">
      <SectionCard
        title="Muhurat"
        subtitle="Auspicious periods (muhurta) based on date/time/location."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="rounded-xl bg-white/5 px-3 py-2 text-sm font-black text-amber-100/80 ring-1 ring-white/10 transition hover:bg-white/10"
            >
              {showRaw ? "Hide Raw JSON" : "Show Raw JSON"}
            </button>
            <button
              type="submit"
              form="muhurat-form"
              disabled={loading}
              className="rounded-xl bg-amber-400/20 px-4 py-2 text-sm font-black text-amber-100 ring-1 ring-amber-300/30 transition hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Loading…" : "Fetch"}
            </button>
          </div>
        }
      >
        <form id="muhurat-form" onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
          <Field label="Date">
            <CalendarDateInput value={form.date} onChange={(next) => setForm((s) => ({ ...s, date: next }))} />
          </Field>
          <Field label="Time">
            <TextInput type="time" value={form.time} onChange={onChange("time")} />
          </Field>
          <Field label="Timezone Offset" hint="+05:30">
            <TextInput value={form.tzOffset} onChange={onChange("tzOffset")} />
          </Field>
          <Field label="Latitude">
            <TextInput value={form.lat} onChange={onChange("lat")} />
          </Field>
          <Field label="Longitude">
            <TextInput value={form.lng} onChange={onChange("lng")} />
          </Field>
          <Field label="Ayanamsa" hint="1, 3, 5">
            <SelectInput value={form.ayanamsa} onChange={onChange("ayanamsa")}>
              <option value="1">1 (Lahiri)</option>
              <option value="3">3</option>
              <option value="5">5</option>
            </SelectInput>
          </Field>
          <Field label="Language (la)">
            <TextInput value={form.la} onChange={onChange("la")} />
          </Field>
        </form>
      </SectionCard>

      {error ? (
        <SectionCard title="Error" subtitle="Backend or Prokerala rejected the request.">
          <JsonBlock value={error} />
        </SectionCard>
      ) : null}

      {spotlight.current || spotlight.next ? (
        <SectionCard
          title={spotlight.current ? "Now" : "Next"}
          subtitle={spotlight.current ? "Current period at selected time." : "Upcoming period after selected time."}
        >
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="text-base font-black text-amber-100">
                  {String((spotlight.current || spotlight.next)?.name || "-")}
                </div>
                <div className="text-xs text-amber-100/70">
                  {fmtTime((spotlight.current || spotlight.next)?.start)} →{" "}
                  {fmtTime((spotlight.current || spotlight.next)?.end)}
                </div>
              </div>
            {(spotlight.current || spotlight.next)?.description ? (
              <div className="mt-2 text-amber-50/90">
                {String((spotlight.current || spotlight.next).description)}
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {auspiciousPeriods.length ? (
        <SectionCard title="Auspicious" subtitle="Good muhurat periods.">
          <div className="grid gap-3">
            {auspiciousPeriods.map((p, idx) => (
              <div
                key={p?.id || p?.name || idx}
                className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="text-base font-black text-amber-100">
                    {String(p?.name || `Period ${idx + 1}`)}
                  </div>
                  <div className="text-xs text-amber-100/70">
                    {fmtTime(p?.start)} → {fmtTime(p?.end)}
                  </div>
                </div>
                {p?.description ? (
                  <div className="mt-2 text-amber-50/90">{String(p.description)}</div>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {inauspiciousPeriods.length ? (
        <SectionCard title="Inauspicious" subtitle="Avoid these kaals for important activities.">
          <div className="grid gap-3">
            {inauspiciousPeriods.map((p, idx) => (
              <div
                key={p?.id || p?.name || idx}
                className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="text-base font-black text-amber-100">
                    {String(p?.name || `Period ${idx + 1}`)}
                  </div>
                  <div className="text-xs text-amber-100/70">
                    {fmtTime(p?.start)} â†’ {fmtTime(p?.end)}
                  </div>
                </div>
                {p?.description ? (
                  <div className="mt-2 text-amber-50/90">{String(p.description)}</div>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {otherPeriods.length ? (
        <SectionCard title="Other Periods" subtitle="Additional periods from provider response.">
          <div className="grid gap-3">
            {otherPeriods.map((p, idx) => (
              <div
                key={p?.id || p?.name || idx}
                className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="text-base font-black text-amber-100">
                    {String(p?.name || `Period ${idx + 1}`)}
                  </div>
                  <div className="text-xs text-amber-100/70">
                    {fmtTime(p?.start)} â†’ {fmtTime(p?.end)}
                  </div>
                </div>
                {p?.description ? (
                  <div className="mt-2 text-amber-50/90">{String(p.description)}</div>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {result && showRaw ? (
        <SectionCard title="Raw JSON (Debug)">
          <JsonBlock value={result} />
        </SectionCard>
      ) : null}
      </div>
    </PageShell>
  );
}
