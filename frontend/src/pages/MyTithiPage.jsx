import { useEffect, useMemo, useRef, useState } from "react";
import PageShell from "./PageShell";
import { getProkeralaPanchang } from "../services/astrologyApi";
import { getAstroDefaults } from "../utils/appSettings";
import { buildIsoDatetime, findActiveByTime, safeDateFromIso, ymdToday } from "../astrology/components/formatters";
import CalendarDateInput from "../components/CalendarDateInput";

const STORAGE_KEY = "panchang:my-tithi";

function readList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export default function MyTithiPage() {
  const defaults = useMemo(() => getAstroDefaults(), []);
  const [items, setItems] = useState(() => (typeof window === "undefined" ? [] : readList()));
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(() => ymdToday());
  const [loadingId, setLoadingId] = useState(null);
  const [computed, setComputed] = useState(() => ({})); // id -> {tithi, paksha}
  const abortRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    writeList(items);
  }, [items]);

  const add = () => {
    const trimmed = label.trim();
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setItems((s) => [{ id, label: trimmed || "My Tithi", date }, ...s]);
    setLabel("");
  };

  const remove = (id) => {
    setItems((s) => s.filter((x) => x.id !== id));
    setComputed((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });
  };

  const compute = async (item) => {
    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadingId(item.id);
    try {
      const payload = await getProkeralaPanchang(
        {
          date: item.date,
          time: "06:00",
          lat: defaults.lat,
          lng: defaults.lng,
          tzOffset: defaults.tzOffset,
          ayanamsa: defaults.ayanamsa,
          la: defaults.la,
        },
        { signal: controller.signal }
      );
      const root = payload?.data || payload;
      const refDate = safeDateFromIso(buildIsoDatetime({ date: item.date, time: "06:00", tzOffset: defaults.tzOffset }));
      const t = findActiveByTime(root?.tithi, refDate);
      setComputed((s) => ({
        ...s,
        [item.id]: {
          tithi: t?.name || "-",
          paksha: t?.paksha || "",
        },
      }));
    } catch (e) {
      if (e?.name === "AbortError") return;
      setComputed((s) => ({
        ...s,
        [item.id]: { tithi: "Error", paksha: e?.message || "" },
      }));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <PageShell title="My Tithi">
      <div className="grid gap-4">
        <section className="app-surface rounded-3xl p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_140px] md:items-end">
            <label className="grid gap-1">
              <span className="text-xs font-black tracking-wide text-amber-100/70">LABEL</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-amber-50 outline-none focus:border-amber-300/35"
                placeholder="Birthday / Anniversary"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-black tracking-wide text-amber-100/70">DATE</span>
              <CalendarDateInput value={date} onChange={setDate} className="rounded-2xl px-4 py-3" />
            </label>
            <button
              type="button"
              onClick={add}
              className="rounded-2xl bg-amber-400/15 px-4 py-3 text-sm font-black text-amber-100 ring-1 ring-amber-300/25 hover:bg-amber-400/20"
            >
              Add
            </button>
          </div>
        </section>

        <section className="app-surface rounded-3xl p-5">
          {items.length ? (
            <div className="grid gap-3">
              {items.map((it) => {
                const c = computed[it.id] || null;
                return (
                  <div key={it.id} className="app-surface-soft rounded-2xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-black text-amber-100">{it.label}</div>
                        <div className="mt-1 text-xs text-amber-100/70">{it.date}</div>
                        {c ? (
                          <div className="mt-2 text-sm text-amber-50">
                            <span className="font-semibold">{c.tithi}</span>
                            {c.paksha ? ` • ${c.paksha}` : ""}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-amber-100/60">Tap “Fetch” to calculate tithi.</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => compute(it)}
                          disabled={loadingId === it.id}
                          className="rounded-xl bg-white/5 px-4 py-2 text-xs font-black text-amber-100 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-60"
                        >
                          {loadingId === it.id ? "Loading…" : "Fetch"}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(it.id)}
                          className="rounded-xl bg-rose-400/10 px-3 py-2 text-xs font-black text-rose-200 ring-1 ring-rose-300/20 hover:bg-rose-400/15"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-amber-100/70">No entries yet. Add a date above.</div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
