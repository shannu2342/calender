import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getProkeralaPanchang } from "../services/astrologyApi";
import { getAstroDefaults } from "../utils/appSettings";
import PageShell from "../pages/PageShell";
import { Field, JsonBlock, SectionCard, SelectInput, TextInput } from "./components/AstroInputs";
import CalendarDateInput from "../components/CalendarDateInput";
import {
  buildIsoDatetime,
  findActiveByTime,
  isoParts,
  periodEnd,
  periodStart,
  pick,
  safeDateFromIso,
  ymdToday,
} from "./components/formatters";

function fmtRange(item) {
  if (!item) return "-";
  const a = isoParts(periodStart(item));
  const b = isoParts(periodEnd(item));
  return `${a.time} → ${b.time}`;
}

export default function PanchangPage() {
  const [form, setForm] = useState(() => ({
    date: ymdToday(),
    time: "00:00",
    ...getAstroDefaults(),
  }));

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const abortRef = useRef(null);
  const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  const [timeHour = "00", timeMinute = "00"] = String(form.time || "00:00").split(":");

  const summary = useMemo(() => {
    const root = result?.data || result;
    if (!root || typeof root !== "object") return null;
    const refDate = safeDateFromIso(
      buildIsoDatetime({ date: form.date, time: form.time, tzOffset: form.tzOffset })
    );
    const tithiActive = findActiveByTime(root?.tithi, refDate);
    const nakshatraActive = findActiveByTime(root?.nakshatra, refDate);
    const yogaActive = findActiveByTime(root?.yoga, refDate);
    const karanaActive = findActiveByTime(root?.karana, refDate);
    return {
      sunrise: pick(root, ["sunrise", "sunrise_time"]),
      sunset: pick(root, ["sunset", "sunset_time"]),
      moonrise: pick(root, ["moonrise"]),
      moonset: pick(root, ["moonset"]),
      vaara: pick(root, ["vaara", "weekday", "day"]),
      tithi: {
        active: tithiActive,
        all: Array.isArray(root?.tithi) ? root.tithi : [],
      },
      nakshatra: {
        active: nakshatraActive,
        all: Array.isArray(root?.nakshatra) ? root.nakshatra : [],
      },
      yoga: {
        active: yogaActive,
        all: Array.isArray(root?.yoga) ? root.yoga : [],
      },
      karana: {
        active: karanaActive,
        all: Array.isArray(root?.karana) ? root.karana : [],
      },
    };
  }, [result, form.date, form.time, form.tzOffset]);

  const onChange = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }));
  const setTimePart = (part, value) => {
    const hh = part === "hour" ? value : timeHour;
    const mm = part === "minute" ? value : timeMinute;
    setForm((s) => ({ ...s, time: `${hh}:${mm}` }));
  };

  const runFetch = async ({ signal } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getProkeralaPanchang({
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

  // Auto-fetch: today’s Panchang should show immediately, and update when the user changes inputs.
  useEffect(() => {
    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;

    const t = setTimeout(() => {
      runFetch({ signal: controller.signal });
    }, 450);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, form.time, form.lat, form.lng, form.tzOffset, form.ayanamsa, form.la]);

  return (
    <PageShell
      title="Panchang"
      right={
        <Link
          to="/settings"
          className="app-btn-secondary inline-flex h-10 w-10 items-center justify-center rounded-xl transition hover:scale-105"
          aria-label="Settings"
          title="Settings"
        >
          ⚙
        </Link>
      }
    >
      <div className="grid w-full min-w-0 gap-6 overflow-x-hidden">
      <SectionCard
        title="Panchang"
        subtitle="Today’s details load automatically. Change date/time/location to view any day."
        right={
          <button
            type="submit"
            form="panchang-form"
            disabled={loading}
            className="app-btn-primary rounded-xl px-4 py-2 text-sm font-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Loading…" : "Fetch"}
          </button>
        }
      >
        <div className="app-panel w-full min-w-0 overflow-x-hidden rounded-2xl p-4">
        <form id="panchang-form" onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
          <Field label="Date" hint="YYYY-MM-DD">
            <CalendarDateInput value={form.date} onChange={(next) => setForm((s) => ({ ...s, date: next }))} />
          </Field>
          <Field label="Time" hint="HH:MM">
            <div className="grid grid-cols-2 gap-2">
              <SelectInput value={timeHour} onChange={(e) => setTimePart("hour", e.target.value)}>
                {hourOptions.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </SelectInput>
              <SelectInput value={timeMinute} onChange={(e) => setTimePart("minute", e.target.value)}>
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </SelectInput>
            </div>
          </Field>
          <Field label="Timezone Offset" hint="+05:30">
            <TextInput value={form.tzOffset} onChange={onChange("tzOffset")} placeholder="+05:30" />
          </Field>

          <Field label="Latitude">
            <TextInput value={form.lat} onChange={onChange("lat")} placeholder="17.3850" />
          </Field>
          <Field label="Longitude">
            <TextInput value={form.lng} onChange={onChange("lng")} placeholder="78.4867" />
          </Field>
          <Field label="Ayanamsa" hint="1, 3, 5">
            <SelectInput value={form.ayanamsa} onChange={onChange("ayanamsa")}>
              <option value="1">1 (Lahiri)</option>
              <option value="3">3</option>
              <option value="5">5</option>
            </SelectInput>
          </Field>

          <Field label="Language (la)" hint="en/hi/te…">
            <TextInput value={form.la} onChange={onChange("la")} placeholder="en" />
          </Field>
        </form>
        </div>
      </SectionCard>

      {error ? (
        <SectionCard title="Error" subtitle="Backend or Prokerala rejected the request.">
          <JsonBlock value={error} />
        </SectionCard>
      ) : null}

      {summary ? (
        <SectionCard
          title="Today (Selected Date/Time)"
          subtitle={`${form.date} ${form.time} ${form.tzOffset} • ${summary.vaara || ""}`}
          right={
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="app-btn-secondary rounded-xl px-3 py-2 text-sm font-black transition hover:brightness-110"
            >
              {showRaw ? "Hide Raw JSON" : "Show Raw JSON"}
            </button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="app-panel rounded-2xl p-4 text-sm text-amber-50">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-amber-100/70">Sunrise</div>
                <div className="font-semibold">{isoParts(summary.sunrise).time}</div>
                <div className="text-amber-100/70">Sunset</div>
                <div className="font-semibold">{isoParts(summary.sunset).time}</div>
                <div className="text-amber-100/70">Moonrise</div>
                <div className="font-semibold">{isoParts(summary.moonrise).time}</div>
                <div className="text-amber-100/70">Moonset</div>
                <div className="font-semibold">{isoParts(summary.moonset).time}</div>
              </div>
            </div>

            <div className="app-surface-soft rounded-2xl p-4 text-sm text-amber-50">
              <div className="grid gap-3">
                <div>
                  <div className="text-xs font-black tracking-wide text-amber-100/70">TITHI</div>
                  <div className="mt-1 text-base font-black text-amber-100">
                    {summary.tithi.active?.name || "-"}
                    {summary.tithi.active?.paksha ? ` • ${summary.tithi.active.paksha}` : ""}
                  </div>
                  <div className="text-xs text-amber-100/70">{fmtRange(summary.tithi.active)}</div>
                </div>

                <div>
                  <div className="text-xs font-black tracking-wide text-amber-100/70">NAKSHATRA</div>
                  <div className="mt-1 text-base font-black text-amber-100">
                    {summary.nakshatra.active?.name || "-"}
                    {summary.nakshatra.active?.lord?.vedic_name
                      ? ` • ${summary.nakshatra.active.lord.vedic_name}`
                      : summary.nakshatra.active?.lord?.name
                        ? ` • ${summary.nakshatra.active.lord.name}`
                        : ""}
                  </div>
                  <div className="text-xs text-amber-100/70">{fmtRange(summary.nakshatra.active)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="app-surface-soft rounded-2xl p-4 text-sm text-amber-50">
              <div className="text-xs font-black tracking-wide text-amber-100/70">YOGA</div>
              <div className="mt-1 text-base font-black text-amber-100">
                {summary.yoga.active?.name || "-"}
              </div>
              <div className="text-xs text-amber-100/70">{fmtRange(summary.yoga.active)}</div>
            </div>
            <div className="app-surface-soft rounded-2xl p-4 text-sm text-amber-50">
              <div className="text-xs font-black tracking-wide text-amber-100/70">KARANA</div>
              <div className="mt-1 text-base font-black text-amber-100">
                {summary.karana.active?.name || "-"}
              </div>
              <div className="text-xs text-amber-100/70">{fmtRange(summary.karana.active)}</div>
            </div>
          </div>

          {summary.tithi.all.length ||
          summary.nakshatra.all.length ||
          summary.yoga.all.length ||
          summary.karana.all.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="app-panel rounded-2xl p-4 text-sm text-amber-50">
                <div className="text-xs font-black tracking-wide text-amber-100/70">ALL TITHI</div>
                <div className="mt-2 grid gap-2">
                  {summary.tithi.all.map((t, idx) => (
                    <div key={`${t?.id || idx}`} className="flex min-w-0 items-baseline justify-between gap-3">
                      <div className="min-w-0 break-words font-semibold">
                        {t?.name || "-"} {t?.paksha ? `(${t.paksha})` : ""}
                      </div>
                      <div className="shrink-0 text-xs text-amber-100/70">{fmtRange(t)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="app-panel rounded-2xl p-4 text-sm text-amber-50">
                <div className="text-xs font-black tracking-wide text-amber-100/70">ALL NAKSHATRA</div>
                <div className="mt-2 grid gap-2">
                  {summary.nakshatra.all.map((n, idx) => (
                    <div key={`${n?.id || idx}`} className="flex min-w-0 items-baseline justify-between gap-3">
                      <div className="min-w-0 break-words font-semibold">
                        {n?.name || "-"}
                        {n?.lord?.vedic_name ? ` • ${n.lord.vedic_name}` : ""}
                      </div>
                      <div className="shrink-0 text-xs text-amber-100/70">{fmtRange(n)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
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

