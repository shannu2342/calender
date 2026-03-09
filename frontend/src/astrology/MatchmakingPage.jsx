import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { postMatchmaking } from "../services/astrologyApi";
import { getAstroDefaults } from "../utils/appSettings";
import PageShell from "../pages/PageShell";
import { Field, JsonBlock, SectionCard, SelectInput, TextInput } from "./components/AstroInputs";
import Accordion from "./components/Accordion";
import { ymdToday } from "./components/formatters";
import CalendarDateInput from "../components/CalendarDateInput";

function badgeByType(type) {
  const t = String(type || "").toLowerCase();
  if (t === "good" || t === "excellent") return "bg-emerald-400/15 text-emerald-200 ring-emerald-300/20";
  if (t === "average" || t === "normal") return "bg-amber-400/15 text-amber-200 ring-amber-300/20";
  if (t === "bad" || t === "poor") return "bg-rose-400/15 text-rose-200 ring-rose-300/20";
  return "bg-white/5 text-amber-100/80 ring-white/10";
}

export default function MatchmakingPage() {
  const abortRef = useRef(null);
  const [showRaw, setShowRaw] = useState(false);
  const [rateLimitedUntil, setRateLimitedUntil] = useState(null);
  const [form, setForm] = useState(() => {
    const defaults = getAstroDefaults();
    return {
      ayanamsa: defaults.ayanamsa,
      la: defaults.la,
      tzOffset: defaults.tzOffset,
      advanced: true,
      groom: {
        date: ymdToday(),
        time: "12:21",
        lat: defaults.lat,
        lng: defaults.lng,
      },
      bride: {
        date: ymdToday(),
        time: "10:30",
        lat: defaults.lat,
        lng: defaults.lng,
      },
    };
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const summary = useMemo(() => {
    const root = result?.data || result;
    if (!root || typeof root !== "object") return null;
    const message = root?.message;
    const guna = root?.guna_milan;
    return {
      messageType: message?.type || null,
      messageText: message?.description || (typeof message === "string" ? message : null),
      totalPoints: guna?.total_points ?? null,
      maximumPoints: guna?.maximum_points ?? null,
      gunas: Array.isArray(guna?.guna) ? guna.guna : [],
      boyInfo: root?.boy_info || null,
      girlInfo: root?.girl_info || null,
      boyManglik: root?.boy_mangal_dosha_details || null,
      girlManglik: root?.girl_mangal_dosha_details || null,
    };
  }, [result]);

  const setPerson = (who, key) => (e) =>
    setForm((s) => ({ ...s, [who]: { ...s[who], [key]: e.target.value } }));
  const onChange = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }));

  const runFetch = async ({ signal } = {}) => {
    const now = Date.now();
    if (rateLimitedUntil && now < rateLimitedUntil) {
      setError({
        message: "Rate limit reached. Please wait before retrying.",
        retryAt: new Date(rateLimitedUntil).toISOString(),
      });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = await postMatchmaking({
        ayanamsa: form.ayanamsa,
        la: form.la,
        tzOffset: form.tzOffset,
        advanced: form.advanced,
        groom: form.groom,
        bride: form.bride,
      }, { signal });
      setResult(payload);
    } catch (err) {
      if (err?.name === "AbortError") return;
      const payload = err?.payload;
      const status = payload?.details?.status ?? err?.status;
      if (status === 429) {
        // Prokerala default limit (per your payload): 5 requests per 60 seconds.
        const until = Date.now() + 60_000;
        setRateLimitedUntil(until);
        setError({
          ...payload,
          message: "You hit Prokerala rate limits (5 requests / 60 seconds). Please wait 60 seconds.",
          retryAt: new Date(until).toISOString(),
        });
        return;
      }
      setError(payload || { message: err?.message || "Request failed" });
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

  // NOTE: Matchmaking is rate-limited by the provider; we intentionally do NOT auto-fetch on every input change.

  return (
    <PageShell
      title="Match Making"
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
        title="Matchmaking"
        subtitle="Kundli Matching (Guna Milan) for Groom/Bride birth details. Provider rate limit: 5 requests / 60 seconds."
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
              form="matchmaking-form"
              disabled={loading || (rateLimitedUntil && Date.now() < rateLimitedUntil)}
              className="rounded-xl bg-amber-400/20 px-4 py-2 text-sm font-black text-amber-100 ring-1 ring-amber-300/30 transition hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Loading…" : "Match"}
            </button>
          </div>
        }
      >
        <form id="matchmaking-form" onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Ayanamsa" hint="1, 3, 5">
              <SelectInput value={form.ayanamsa} onChange={onChange("ayanamsa")}>
                <option value="1">1 (Lahiri)</option>
                <option value="3">3</option>
                <option value="5">5</option>
              </SelectInput>
            </Field>
            <Field label="Timezone Offset" hint="+05:30">
              <TextInput value={form.tzOffset} onChange={onChange("tzOffset")} />
            </Field>
            <Field label="Language (la)" hint="en/hi/te…">
              <TextInput value={form.la} onChange={onChange("la")} />
            </Field>
            <label className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-amber-50">
              <input
                type="checkbox"
                checked={Boolean(form.advanced)}
                onChange={(e) => setForm((s) => ({ ...s, advanced: e.target.checked }))}
              />
              <span className="font-semibold">Advanced</span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard title="Groom" subtitle="Birth details">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Date">
                  <CalendarDateInput
                    value={form.groom.date}
                    onChange={(next) =>
                      setForm((s) => ({ ...s, groom: { ...s.groom, date: next } }))
                    }
                  />
                </Field>
                <Field label="Time">
                  <TextInput type="time" value={form.groom.time} onChange={setPerson("groom", "time")} />
                </Field>
                <Field label="Latitude">
                  <TextInput value={form.groom.lat} onChange={setPerson("groom", "lat")} />
                </Field>
                <Field label="Longitude">
                  <TextInput value={form.groom.lng} onChange={setPerson("groom", "lng")} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Bride" subtitle="Birth details">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Date">
                  <CalendarDateInput
                    value={form.bride.date}
                    onChange={(next) =>
                      setForm((s) => ({ ...s, bride: { ...s.bride, date: next } }))
                    }
                  />
                </Field>
                <Field label="Time">
                  <TextInput type="time" value={form.bride.time} onChange={setPerson("bride", "time")} />
                </Field>
                <Field label="Latitude">
                  <TextInput value={form.bride.lat} onChange={setPerson("bride", "lat")} />
                </Field>
                <Field label="Longitude">
                  <TextInput value={form.bride.lng} onChange={setPerson("bride", "lng")} />
                </Field>
              </div>
            </SectionCard>
          </div>
        </form>
      </SectionCard>

      {error ? (
        <SectionCard title="Error" subtitle="Backend or Prokerala rejected the request.">
          <JsonBlock value={error} />
        </SectionCard>
      ) : null}

      {summary ? (
        <SectionCard title="Result" subtitle="Rendered from Prokerala matching data (raw JSON optional).">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-black tracking-wide text-amber-100">Guna Milan</div>
                <div className="text-xs text-amber-100/70">
                  {summary.totalPoints != null && summary.maximumPoints != null
                    ? `${summary.totalPoints} / ${summary.maximumPoints}`
                    : "—"}
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-400/50"
                  style={{
                    width:
                      summary.totalPoints != null && summary.maximumPoints
                        ? `${Math.min(100, (summary.totalPoints / summary.maximumPoints) * 100)}%`
                        : "0%",
                  }}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="text-amber-100/70">Groom Rasi</div>
                <div className="font-semibold">
                  {summary.boyInfo?.rasi?.name || "-"}
                </div>
                <div className="text-amber-100/70">Bride Rasi</div>
                <div className="font-semibold">
                  {summary.girlInfo?.rasi?.name || "-"}
                </div>
                <div className="text-amber-100/70">Groom Nakshatra</div>
                <div className="font-semibold">
                  {summary.boyInfo?.nakshatra?.name
                    ? `${summary.boyInfo.nakshatra.name} (Pada ${summary.boyInfo.nakshatra.pada ?? "-"})`
                    : "-"}
                </div>
                <div className="text-amber-100/70">Bride Nakshatra</div>
                <div className="font-semibold">
                  {summary.girlInfo?.nakshatra?.name
                    ? `${summary.girlInfo.nakshatra.name} (Pada ${summary.girlInfo.nakshatra.pada ?? "-"})`
                    : "-"}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-black tracking-wide text-amber-100">Message</div>
                {summary.messageType ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-black ring-1 ${badgeByType(
                      summary.messageType
                    )}`}
                  >
                    {String(summary.messageType).toUpperCase()}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 whitespace-pre-wrap font-semibold text-amber-50/95">
                {summary.messageText || "-"}
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SectionCard title="Manglik (Groom)">
              <div className="text-sm text-amber-50">
                <div className="text-amber-100/70">
                  {summary.boyManglik?.dosha_type ? `Type: ${summary.boyManglik.dosha_type}` : "—"}
                </div>
                <div className="mt-2 whitespace-pre-wrap font-semibold">
                  {summary.boyManglik?.description || "-"}
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Manglik (Bride)">
              <div className="text-sm text-amber-50">
                <div className="text-amber-100/70">
                  {summary.girlManglik?.dosha_type ? `Type: ${summary.girlManglik.dosha_type}` : "—"}
                </div>
                <div className="mt-2 whitespace-pre-wrap font-semibold">
                  {summary.girlManglik?.description || "-"}
                </div>
              </div>
            </SectionCard>
          </div>

          {summary.gunas?.length ? (
            <div className="mt-6">
              <SectionCard title="Ashta Koota (Details)" subtitle="Tap a koota to view description.">
                <Accordion
                  items={summary.gunas}
                  getKey={(g) => g?.id || g?.name}
                  renderHeader={(g) => (
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div className="text-sm font-black text-amber-100">{String(g?.name || "-")}</div>
                      <div className="text-xs text-amber-100/70">
                        {String(g?.obtained_points ?? "-")} / {String(g?.maximum_points ?? "-")}
                      </div>
                      <div className="w-full text-xs text-amber-50/90">
                        Groom: <span className="font-semibold">{String(g?.boy_koot ?? "-")}</span>
                        {" • "}
                        Bride: <span className="font-semibold">{String(g?.girl_koot ?? "-")}</span>
                      </div>
                    </div>
                  )}
                  renderBody={(g) => (
                    <div className="whitespace-pre-wrap text-sm text-amber-50/90">
                      {String(g?.description || "-")}
                    </div>
                  )}
                />
              </SectionCard>
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
