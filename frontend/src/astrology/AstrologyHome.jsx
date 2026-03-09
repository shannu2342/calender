import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getProkeralaPanchang } from "../services/astrologyApi";
import { getAstroDefaults } from "../utils/appSettings";
import PageShell from "../pages/PageShell";
import { JsonBlock, SectionCard } from "./components/AstroInputs";
import CalendarDateInput from "../components/CalendarDateInput";
import {
  buildIsoDatetime,
  findActiveByTime,
  isoParts,
  safeDateFromIso,
  ymdToday,
} from "./components/formatters";

function Tile({ to, title, subtitle }) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition hover:bg-white/10"
    >
      <div className="text-base font-black tracking-wide text-amber-100 group-hover:text-amber-50">
        {title}
      </div>
      <div className="mt-1 text-xs text-amber-100/60">{subtitle}</div>
    </Link>
  );
}

export default function AstrologyHome() {
  const [form, setForm] = useState(() => ({
    date: ymdToday(),
    time: "12:00",
    ...getAstroDefaults(),
  }));

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const onChange = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }));

  useEffect(() => {
    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const t = setTimeout(async () => {
      try {
        const payload = await getProkeralaPanchang({
          date: form.date,
          time: form.time,
          lat: form.lat,
          lng: form.lng,
          tzOffset: form.tzOffset,
          ayanamsa: form.ayanamsa,
          la: form.la,
        }, { signal: controller.signal });
        setResult(payload);
      } catch (err) {
        if (err?.name === "AbortError") return;
        setError(err?.payload || { message: err?.message || "Request failed" });
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, form.time, form.lat, form.lng, form.tzOffset, form.ayanamsa, form.la]);

  const banner = useMemo(() => {
    const root = result?.data || result;
    if (!root || typeof root !== "object") return null;
    const refDate = safeDateFromIso(
      buildIsoDatetime({ date: form.date, time: form.time, tzOffset: form.tzOffset })
    );
    const tithi = findActiveByTime(root?.tithi, refDate);
    const nakshatra = findActiveByTime(root?.nakshatra, refDate);
    const vaara = root?.vaara;
    return {
      vaara,
      tithiLabel: tithi?.name ? `${tithi.name}${tithi.paksha ? `, ${tithi.paksha}` : ""}` : "-",
      nakshatraLabel: nakshatra?.name || "-",
      sunrise: isoParts(root?.sunrise).time,
      sunset: isoParts(root?.sunset).time,
    };
  }, [result, form.date, form.time, form.tzOffset]);

  return (
    <PageShell
      title="Astrology"
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
        title="Hindu Calendar"
        subtitle="Overview + quick navigation. Panchang summary auto-loads (like the app screenshots)."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-amber-100">Date</div>
            <CalendarDateInput value={form.date} onChange={(next) => setForm((s) => ({ ...s, date: next }))} />
          </label>
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-amber-100">Time</div>
            <input
              type="time"
              value={form.time}
              onChange={onChange("time")}
              className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-amber-50 outline-none transition focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-amber-100">Location (Lat, Lng)</div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.lat}
                onChange={onChange("lat")}
                placeholder="17.3850"
                className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-amber-50 outline-none transition focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
              />
              <input
                value={form.lng}
                onChange={onChange("lng")}
                placeholder="78.4867"
                className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-amber-50 outline-none transition focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
              />
            </div>
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-amber-50">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="text-sm font-black tracking-wide text-amber-100">
              {loading ? "Loading…" : banner ? `${banner.vaara} • ${form.date}` : "—"}
            </div>
            {banner ? (
              <div className="text-xs text-amber-100/70">
                Sunrise {banner.sunrise} • Sunset {banner.sunset}
              </div>
            ) : null}
          </div>
          {banner ? (
            <div className="mt-2 text-sm text-amber-50/90">
              <span className="font-semibold">{banner.tithiLabel}</span>
              {" • "}
              <span className="font-semibold">{banner.nakshatraLabel}</span>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mt-4">
            <JsonBlock value={error} />
          </div>
        ) : null}
      </SectionCard>

      <div className="grid gap-3 md:grid-cols-2">
        <Tile to="/panchang" title="Panchang" subtitle="Day view • tithi/nakshatra/yoga/karana" />
        <Tile to="/kundali" title="Kundali" subtitle="Planet positions • info • dasha" />
        <Tile to="/matchmaking" title="Match Making" subtitle="Groom/Bride • guna milan" />
        <Tile to="/muhurat" title="Muhurt" subtitle="Auspicious periods" />
      </div>
      </div>
    </PageShell>
  );
}
