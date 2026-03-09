import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { postKundali } from "../services/astrologyApi";
import { getAstroDefaults } from "../utils/appSettings";
import PageShell from "../pages/PageShell";
import { Field, JsonBlock, SectionCard, SelectInput, TextInput } from "./components/AstroInputs";
import { buildIsoDatetime, findActiveByTime, pick, safeDateFromIso, ymdToday } from "./components/formatters";
import DashaView from "./components/DashaView";
import NorthIndianChart from "./components/NorthIndianChart";
import CalendarDateInput from "../components/CalendarDateInput";

function safeObj(value) {
  return value && typeof value === "object" ? value : null;
}

function planetRows(root) {
  const data = root?.data || root;
  const candidates = [
    data?.planet_positions,
    data?.planet_positions?.data,
    data?.planets,
    data?.planetPosition,
    data?.planet_position,
    data?.horoscope?.planet_positions,
  ];
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length) return arr;
  }
  return [];
}

function normalizePlanetRow(p) {
  const name = p?.name || p?.planet || p?.id || "-";
  const rashi = p?.rasi?.name || p?.rasi || p?.sign?.name || p?.sign || "-";
  const degree = p?.degree ?? p?.longitude ?? p?.position ?? p?.deg ?? "-";
  const nak = p?.nakshatra?.name || p?.nakshatra?.id || p?.nakshatra || "-";
  const pada = p?.nakshatra?.pada ?? p?.pada ?? "-";
  return { name, rashi, degree, nakshatra: nak, pada };
}

function findPlanetSets(root) {
  const data = root?.data || root;
  const candidates = [
    { label: "Nirayana (Sidereal)", rows: data?.nirayana?.planet_positions || data?.nirayana?.planets },
    { label: "Sayana (Tropical)", rows: data?.sayana?.planet_positions || data?.sayana?.planets },
    { label: "Tropical", rows: data?.tropical?.planet_positions || data?.tropical?.planets },
  ];
  const sets = candidates.filter((s) => Array.isArray(s.rows) && s.rows.length);
  if (sets.length) return sets;
  const fallback = planetRows(data) || planetRows(root);
  return fallback.length ? [{ label: "Planet Positions", rows: fallback }] : [];
}

function YogaDetails({ value }) {
  const data = value?.data || value;
  const groups = Array.isArray(data?.yoga_details) ? data.yoga_details : [];
  if (!groups.length) return null;

  return (
    <div className="grid gap-3">
      {groups.map((g, idx) => (
        <SectionCard
          key={`${g?.name || "group"}-${idx}`}
          title={String(g?.name || `Yoga Group ${idx + 1}`)}
          subtitle={String(g?.description || "")}
        >
          <div className="grid gap-2">
            {(Array.isArray(g?.yoga_list) ? g.yoga_list : []).map((y, yIdx) => (
              <div
                key={`${y?.name || "yoga"}-${yIdx}`}
                className="rounded-2xl border border-white/10 bg-black/15 p-3 sm:p-4 text-sm text-amber-50"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="text-base font-black text-amber-100">{String(y?.name || "-")}</div>
                  <div
                    className={`text-xs font-black ${y?.has_yoga ? "text-emerald-200" : "text-amber-100/70"}`}
                  >
                    {y?.has_yoga ? "YES" : "NO"}
                  </div>
                </div>
                <div className="mt-2 break-words text-amber-50/90">{String(y?.description || "-")}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

export default function KundaliPage() {
  const [tab, setTab] = useState("info");
  const [showRaw, setShowRaw] = useState(false);
  const [showYogas, setShowYogas] = useState(false);
  const abortRef = useRef(null);
  const [form, setForm] = useState(() => ({
    date: ymdToday(),
    time: "12:21",
    ...getAstroDefaults(),
  }));

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const root = useMemo(() => safeObj(result?.data || result) || null, [result]);
  const planetSets = useMemo(() => findPlanetSets(result), [result]);

  const nirayanaRows = useMemo(() => {
    const nirayana = planetSets.find((s) => /nirayana|sidereal/i.test(String(s.label || "")));
    return (nirayana?.rows || planetSets[0]?.rows || []).map(normalizePlanetRow);
  }, [planetSets]);

  const lagnaRow = useMemo(() => {
    return nirayanaRows.find((r) => /lagna|ascendant/i.test(String(r.name))) || null;
  }, [nirayanaRows]);

  const moonRow = useMemo(() => {
    return (
      nirayanaRows.find((r) => /chandra|moon/i.test(String(r.name))) ||
      nirayanaRows.find((r) => /chandra/i.test(String(r.name))) ||
      null
    );
  }, [nirayanaRows]);

  const panchang = useMemo(() => {
    const data = result?.data || result;
    const maybe = data?.panchang || data?.panchanga || root?.panchang || null;
    const unwrapped = maybe?.data || maybe;
    return unwrapped && typeof unwrapped === "object" ? unwrapped : null;
  }, [result, root]);

  const info = useMemo(() => {
    if (!result) return null;
    const data = result?.data || result;
    const nakshatraDetails = data?.nakshatra_details || root?.nakshatra_details || null;
    const addInfo = nakshatraDetails?.additional_info || null;
    const refDate = safeDateFromIso(buildIsoDatetime(form));

    const tithiActive = findActiveByTime(panchang?.tithi, refDate) || (Array.isArray(panchang?.tithi) ? panchang.tithi[0] : null);
    const nakshatraActive =
      (nakshatraDetails?.nakshatra || null) ||
      findActiveByTime(panchang?.nakshatra, refDate) ||
      (Array.isArray(panchang?.nakshatra) ? panchang.nakshatra[0] : null);
    const yogaActive = findActiveByTime(panchang?.yoga, refDate) || (Array.isArray(panchang?.yoga) ? panchang.yoga[0] : null);
    const karanaActive = findActiveByTime(panchang?.karana, refDate) || (Array.isArray(panchang?.karana) ? panchang.karana[0] : null);

    const moonSign = pick(root, ["rasi", "rashi", "moon_sign", "chandra_rasi", "moon_rasi"]);
    const lagnaSign = pick(root, ["ascendant", "lagna", "ascendant_sign"]);
    const moonRashi =
      moonRow?.rashi ||
      (typeof moonSign === "string" ? moonSign : moonSign?.name || moonSign?.rasi?.name || null);
    const lagnaRashi =
      lagnaRow?.rashi ||
      (typeof lagnaSign === "string" ? lagnaSign : lagnaSign?.rasi?.name || lagnaSign?.name || null);
    return {
      datetime: pick(root, ["datetime", "birth_datetime", "dob", "date_time"]) || buildIsoDatetime(form),
      coordinates:
        pick(root, ["coordinates", "location", "geo", "birth_place"]) ||
        `${Number(form.lat).toFixed(4)},${Number(form.lng).toFixed(4)}`,
      vaara: pick(panchang, ["vaara", "weekday", "day"]) || pick(root, ["vaara", "weekday"]),
      rashi: moonRashi || "-",
      lagna: lagnaRashi || "-",
      lagnaDegree: lagnaRow?.degree ?? pick(root, ["ascendant", "lagna"])?.degree ?? "-",
      tithi: tithiActive || pick(root, ["tithi"]) || null,
      nakshatra: nakshatraActive || pick(root, ["nakshatra"]) || null,
      yoga: yogaActive || pick(root, ["yoga"]) || null,
      karana: karanaActive || pick(root, ["karana"]) || null,
      sunrise: pick(panchang, ["sunrise"]) || pick(root, ["sunrise"]) || null,
      dashaBalance:
        pick(root, ["balance_of_dasha", "dasha_balance"]) ||
        pick(root, ["vimshottari_dasha", "vimshottari"])?.balance ||
        null,
      mangalDosha:
        pick(root, ["mangal_dosha", "manglik", "mangal_dosha_details"]) ||
        null,
      ayanamsa: pick(root, ["ayanamsa"]) || pick(root, ["ayanamsa_name"]) || form.ayanamsa || "-",

      rashiSwami:
        nakshatraDetails?.chandra_rasi?.lord?.vedic_name ||
        nakshatraDetails?.chandra_rasi?.lord?.name ||
        null,
      nakshatraSwami:
        nakshatraDetails?.nakshatra?.lord?.vedic_name ||
        nakshatraDetails?.nakshatra?.lord?.name ||
        null,
      yoni: addInfo?.animal_sign || null,
      gana: addInfo?.ganam || null,
      nadi: addInfo?.nadi || null,
      deity: addInfo?.deity || null,
      syllables: addInfo?.syllables || null,
    };
  }, [root, form, panchang, moonRow, lagnaRow, result]);

  const onChange = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }));

  const runFetch = async ({ signal } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await postKundali({
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

  return (
    <PageShell
      title="Kundali"
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
        title="Kundali"
        subtitle="Birth chart (advanced) from Prokerala. Use date/time and birthplace coordinates."
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
              form="kundali-form"
              disabled={loading}
              className="rounded-xl bg-amber-400/20 px-4 py-2 text-sm font-black text-amber-100 ring-1 ring-amber-300/30 transition hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Loading…" : "Generate"}
            </button>
          </div>
        }
      >
        <form id="kundali-form" onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
          <Field label="Date" hint="YYYY-MM-DD">
            <CalendarDateInput value={form.date} onChange={(next) => setForm((s) => ({ ...s, date: next }))} />
          </Field>
          <Field label="Time" hint="HH:MM">
            <TextInput type="time" value={form.time} onChange={onChange("time")} />
          </Field>
          <Field label="Location Name" hint="Optional (for display)">
            <TextInput value={form.locationName} onChange={onChange("locationName")} placeholder="Ujjain, India" />
          </Field>
          <Field label="Timezone Offset" hint="+05:30">
            <TextInput value={form.tzOffset} onChange={onChange("tzOffset")} placeholder="+05:30" />
          </Field>

          <Field label="Latitude">
            <TextInput value={form.lat} onChange={onChange("lat")} placeholder="23.1500" />
          </Field>
          <Field label="Longitude">
            <TextInput value={form.lng} onChange={onChange("lng")} placeholder="75.7700" />
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

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: "info", label: "Info" },
            { id: "kundali", label: "Kundali" },
            { id: "dasha", label: "Dasha" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl px-3 py-2 text-sm font-black ring-1 transition ${
                tab === t.id
                  ? "bg-amber-400/20 text-amber-100 ring-amber-300/30"
                  : "bg-white/5 text-amber-100/80 ring-white/10 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </SectionCard>

      {error ? (
        <SectionCard title="Error" subtitle="Backend or Prokerala rejected the request.">
          <JsonBlock value={error} />
        </SectionCard>
      ) : null}

      {tab === "info" && info ? (
        <SectionCard title="Info" subtitle="Key values rendered (raw JSON optional).">
          <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50">
            <div className="text-amber-100/80">
              Location:{" "}
              <span className="font-semibold">
                {form.locationName?.trim()
                  ? form.locationName.trim()
                  : `${Number(form.lat).toFixed(2)}, ${Number(form.lng).toFixed(2)}`}
              </span>
            </div>
            <div className="mt-1 text-amber-100/70">
              {form.date} {info.vaara ? `, ${info.vaara}` : ""} • {form.time} ({form.tzOffset})
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-amber-100/70">Rashi</div>
                <div className="font-semibold">{String(info.rashi || "-")}</div>
                <div className="text-amber-100/70">Lagna</div>
                <div className="font-semibold">
                  {String(info.lagna || "-")}{" "}
                  {info.lagnaDegree !== "-" ? (
                    <span className="text-emerald-200">{String(info.lagnaDegree)}</span>
                  ) : null}
                </div>
                <div className="text-amber-100/70">Balance Of Dasha</div>
                <div className="font-semibold">
                  {typeof info.dashaBalance === "string"
                    ? info.dashaBalance
                    : info.dashaBalance?.description || info.dashaBalance?.dosha_type || "-"}
                </div>
                <div className="text-amber-100/70">Mangal Dosha</div>
                <div className="font-semibold">
                  {typeof info.mangalDosha === "string"
                    ? info.mangalDosha
                    : info.mangalDosha?.description || (info.mangalDosha?.has_dosha === false ? "No" : "-")}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-amber-100/70">Datetime</div>
                <div className="font-semibold">{String(info.datetime ?? "-")}</div>
                <div className="text-amber-100/70">Ayanamsa</div>
                <div className="font-semibold">{String(info.ayanamsa ?? "-")}</div>
                <div className="text-amber-100/70">Tithi</div>
                <div className="font-semibold">
                  {String(info.tithi?.name || info.tithi || "-")}
                  {info.tithi?.paksha ? `, ${info.tithi.paksha}` : ""}
                </div>
                <div className="text-amber-100/70">Nakshatra</div>
                <div className="font-semibold">
                  {String(info.nakshatra?.name || info.nakshatra || "-")}
                  {moonRow?.pada != null && moonRow?.pada !== "-" ? ` (Pada ${moonRow?.pada})` : ""}
                </div>
                <div className="text-amber-100/70">Yoga</div>
                <div className="font-semibold">{String(info.yoga?.name || info.yoga || "-")}</div>
                <div className="text-amber-100/70">Karana</div>
                <div className="font-semibold">{String(info.karana?.name || info.karana || "-")}</div>
                <div className="text-amber-100/70">Sunrise</div>
                <div className="font-semibold">{String(info.sunrise || "-")}</div>
              </div>
            </div>
          </div>

          {(info.rashiSwami || info.nakshatraSwami || info.yoni || info.gana || info.nadi) ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-amber-100/70">Rashi Swami</div>
                <div className="font-semibold">{String(info.rashiSwami || "-")}</div>
                <div className="text-amber-100/70">Nakshatra Swami</div>
                <div className="font-semibold">{String(info.nakshatraSwami || "-")}</div>
                <div className="text-amber-100/70">Yoni</div>
                <div className="font-semibold">{String(info.yoni || "-")}</div>
                <div className="text-amber-100/70">Gana</div>
                <div className="font-semibold">{String(info.gana || "-")}</div>
                <div className="text-amber-100/70">Nadi</div>
                <div className="font-semibold">{String(info.nadi || "-")}</div>
                <div className="text-amber-100/70">Deity</div>
                <div className="font-semibold">{String(info.deity || "-")}</div>
                <div className="text-amber-100/70">Syllables</div>
                <div className="font-semibold">{String(info.syllables || "-")}</div>
              </div>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {tab === "kundali" ? (
        <div className="grid gap-6">
          {planetSets.length ? (
            <>
              {lagnaRow?.rashi ? (
            <SectionCard title="Kundali Chart" subtitle="North Indian chart (best-effort from Lagna + planet rashi).">
              <NorthIndianChart lagnaRashi={lagnaRow.rashi} planets={nirayanaRows} />
            </SectionCard>
          ) : (
            <SectionCard title="Kundali Chart" subtitle="Chart needs Lagna rashi from the response.">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50">
                Lagna not found yet. Click “Generate” and (if needed) enable “Show Raw JSON” to confirm the response.
              </div>
            </SectionCard>
          )}
          {planetSets.map((set) => (
            <SectionCard
              key={set.label}
              title={set.label}
              subtitle="Rendered from Prokerala planet positions."
            >
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <table className="hidden w-full text-left text-sm text-amber-50 md:table">
                  <thead className="bg-black/30 text-amber-100/80">
                    <tr>
                      <th className="px-3 py-2">Planet</th>
                      <th className="px-3 py-2">Rashi</th>
                      <th className="px-3 py-2">Degree</th>
                      <th className="px-3 py-2">Nakshatra</th>
                      <th className="px-3 py-2">Pada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-black/15">
                    {set.rows.map((p, idx) => {
                      const row = normalizePlanetRow(p);
                      return (
                        <tr key={`${row.name}-${idx}`} className="hover:bg-white/5">
                          <td className="px-3 py-2 font-semibold">{String(row.name)}</td>
                          <td className="px-3 py-2">{String(row.rashi)}</td>
                          <td className="px-3 py-2">{String(row.degree)}</td>
                          <td className="px-3 py-2">{String(row.nakshatra)}</td>
                          <td className="px-3 py-2">{String(row.pada)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="grid gap-2 p-2 md:hidden">
                  {set.rows.map((p, idx) => {
                    const row = normalizePlanetRow(p);
                    return (
                      <div key={`${row.name}-${idx}`} className="rounded-xl border border-white/10 bg-black/20 p-2 text-xs text-amber-50">
                        <div className="font-black text-amber-100">{String(row.name)}</div>
                        <div className="mt-1 grid grid-cols-2 gap-1">
                          <div className="text-amber-100/70">Rashi</div>
                          <div>{String(row.rashi)}</div>
                          <div className="text-amber-100/70">Degree</div>
                          <div className="break-all">{String(row.degree)}</div>
                          <div className="text-amber-100/70">Nakshatra</div>
                          <div className="break-words">{String(row.nakshatra)}</div>
                          <div className="text-amber-100/70">Pada</div>
                          <div>{String(row.pada)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SectionCard>
          ))}
            </>
          ) : (
            <SectionCard title="Kundali" subtitle="Planet positions are missing in this response.">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50">
                This response includes Nakshatra/Yogas/Dasha, but not planet positions.
                If you already set `PROKERALA_ENDPOINT_PLANET_POSITIONS`, restart the backend so it can enrich Kundali with planet positions.
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Yogas"
            subtitle="Optional: expand to view yoga details from the response."
            right={
              <button
                type="button"
                onClick={() => setShowYogas((v) => !v)}
                className="rounded-xl bg-white/5 px-3 py-2 text-sm font-black text-amber-100/80 ring-1 ring-white/10 transition hover:bg-white/10"
              >
                {showYogas ? "Hide" : "Show"}
              </button>
            }
          >
            {showYogas ? <YogaDetails value={result} /> : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-amber-50">
                Tap “Show” to view yoga groups (Major/Chandra/Soorya/Inauspicious, etc).
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      {tab === "dasha" && root ? (
        <SectionCard title="Dasha" subtitle="Rendered as Vimshottari Mahadasha when available.">
          <DashaView value={result} />
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
