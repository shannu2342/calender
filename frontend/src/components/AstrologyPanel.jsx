import { useEffect, useMemo, useState } from "react";
import {
  getProkeralaPanchang,
  postKundali,
  postMatchmaking,
  postMuhurat,
} from "../services/astrologyApi";
import CalendarDateInput from "./CalendarDateInput";

const DEFAULT_LAT = "17.3850"; // Hyderabad (safe placeholder)
const DEFAULT_LNG = "78.4867";

function toIsoDateFromDmy(dmy) {
  // Input expected like "DD/MM/YYYY"
  const parts = String(dmy || "").split("/");
  if (parts.length !== 3) return "";
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return "";
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function safeJsonParse(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

export default function AstrologyPanel({ isOpen, onClose, selectedDay }) {
  const [activeTab, setActiveTab] = useState("panchang"); // panchang | kundali | matchmaking | muhurat

  const [date, setDate] = useState("");
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);

  const [kundaliJson, setKundaliJson] = useState(
    JSON.stringify(
      {
        // Fill with Prokerala-required payload fields for your plan.
        // This UI forwards JSON exactly as-is to the backend.
      },
      null,
      2
    )
  );
  const [matchmakingJson, setMatchmakingJson] = useState(
    JSON.stringify(
      {
        // Fill with Prokerala-required payload fields for your plan.
      },
      null,
      2
    )
  );
  const [muhuratJson, setMuhuratJson] = useState(
    JSON.stringify(
      {
        // Fill with Prokerala-required payload fields for your plan.
      },
      null,
      2
    )
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);

  const selectedIsoDate = useMemo(() => toIsoDateFromDmy(selectedDay?.date), [selectedDay]);

  // When opening, prefer the currently selected calendar date (if present).
  useEffect(() => {
    if (!isOpen) return;
    if (selectedIsoDate) setDate(selectedIsoDate);
  }, [isOpen, selectedIsoDate]);

  const runRequest = async () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      if (activeTab === "panchang") {
        const data = await getProkeralaPanchang({ date, lat, lng });
        setResponse(data);
        return;
      }

      if (activeTab === "kundali") {
        const parsed = safeJsonParse(kundaliJson);
        if (!parsed.ok) throw new Error("Invalid JSON in Kundali request body.");
        const data = await postKundali(parsed.value);
        setResponse(data);
        return;
      }

      if (activeTab === "matchmaking") {
        const parsed = safeJsonParse(matchmakingJson);
        if (!parsed.ok) throw new Error("Invalid JSON in Matchmaking request body.");
        const data = await postMatchmaking(parsed.value);
        setResponse(data);
        return;
      }

      if (activeTab === "muhurat") {
        const parsed = safeJsonParse(muhuratJson);
        if (!parsed.ok) throw new Error("Invalid JSON in Muhurat request body.");
        const data = await postMuhurat(parsed.value);
        setResponse(data);
        return;
      }
    } catch (e) {
      setError(e?.payload || { message: e?.message || "Request failed" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-4xl rounded-2xl overflow-hidden backdrop-blur-md"
        style={{
          background: "linear-gradient(135deg, rgba(50, 18, 10, 0.98) 0%, rgba(80, 25, 12, 0.96) 100%)",
          border: "2px solid rgba(255, 140, 50, 0.65)",
          boxShadow: "0 16px 50px rgba(0,0,0,0.55)",
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255, 140, 50, 0.35)" }}
        >
          <div className="font-black tracking-wide" style={{ color: "#FFE4B5" }}>
            Prokerala Astrology (Backend API)
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-bold"
            style={{
              color: "#FFE4B5",
              background: "rgba(255, 140, 50, 0.15)",
              border: "1px solid rgba(255, 140, 50, 0.35)",
            }}
          >
            Close
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["panchang", "Panchang"],
              ["kundali", "Kundali"],
              ["matchmaking", "Matchmaking"],
              ["muhurat", "Muhurat"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className="rounded-full px-3 py-1 text-sm font-extrabold"
                style={{
                  color: activeTab === key ? "#1a0a05" : "#FFE4B5",
                  background:
                    activeTab === key
                      ? "linear-gradient(135deg, #ffd89a 0%, #ff8c2f 100%)"
                      : "rgba(255, 140, 50, 0.15)",
                  border: "1px solid rgba(255, 140, 50, 0.35)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
          <div className="space-y-3">
            {activeTab === "panchang" && (
              <div className="space-y-2">
                <div className="text-sm font-extrabold" style={{ color: "#FFE4B5" }}>
                  GET `/api/astrology/panchang`
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="text-xs font-bold" style={{ color: "rgba(255,228,181,0.9)" }}>
                    Date (YYYY-MM-DD)
                    <div className="mt-1">
                      <CalendarDateInput value={date} onChange={setDate} placeholder="2026-02-17" />
                    </div>
                  </label>

                  <label className="text-xs font-bold" style={{ color: "rgba(255,228,181,0.9)" }}>
                    Lat
                    <input
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      style={{
                        background: "rgba(0,0,0,0.25)",
                        border: "1px solid rgba(255, 140, 50, 0.35)",
                        color: "#FFF1D6",
                      }}
                      placeholder="17.3850"
                    />
                  </label>

                  <label className="text-xs font-bold" style={{ color: "rgba(255,228,181,0.9)" }}>
                    Lng
                    <input
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      style={{
                        background: "rgba(0,0,0,0.25)",
                        border: "1px solid rgba(255, 140, 50, 0.35)",
                        color: "#FFF1D6",
                      }}
                      placeholder="78.4867"
                    />
                  </label>
                </div>

                {selectedIsoDate && (
                  <button
                    type="button"
                    onClick={() => setDate(selectedIsoDate)}
                    className="text-xs font-bold rounded-lg px-3 py-2"
                    style={{
                      color: "#FFE4B5",
                      background: "rgba(255, 140, 50, 0.12)",
                      border: "1px solid rgba(255, 140, 50, 0.3)",
                    }}
                  >
                    Use selected calendar date ({selectedIsoDate})
                  </button>
                )}
              </div>
            )}

            {activeTab === "kundali" && (
              <div className="space-y-2">
                <div className="text-sm font-extrabold" style={{ color: "#FFE4B5" }}>
                  POST `/api/astrology/kundali`
                </div>
                <textarea
                  value={kundaliJson}
                  onChange={(e) => setKundaliJson(e.target.value)}
                  rows={12}
                  className="w-full rounded-xl p-3 text-xs font-mono"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255, 140, 50, 0.35)",
                    color: "#FFF1D6",
                  }}
                />
              </div>
            )}

            {activeTab === "matchmaking" && (
              <div className="space-y-2">
                <div className="text-sm font-extrabold" style={{ color: "#FFE4B5" }}>
                  POST `/api/astrology/matchmaking`
                </div>
                <textarea
                  value={matchmakingJson}
                  onChange={(e) => setMatchmakingJson(e.target.value)}
                  rows={12}
                  className="w-full rounded-xl p-3 text-xs font-mono"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255, 140, 50, 0.35)",
                    color: "#FFF1D6",
                  }}
                />
              </div>
            )}

            {activeTab === "muhurat" && (
              <div className="space-y-2">
                <div className="text-sm font-extrabold" style={{ color: "#FFE4B5" }}>
                  POST `/api/astrology/muhurat`
                </div>
                <textarea
                  value={muhuratJson}
                  onChange={(e) => setMuhuratJson(e.target.value)}
                  rows={12}
                  className="w-full rounded-xl p-3 text-xs font-mono"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255, 140, 50, 0.35)",
                    color: "#FFF1D6",
                  }}
                />
              </div>
            )}

            <button
              type="button"
              onClick={runRequest}
              disabled={isLoading}
              className="w-full rounded-xl px-4 py-3 text-sm font-black tracking-wide disabled:opacity-60"
              style={{
                color: "#1a0a05",
                background: "linear-gradient(135deg, #ffd89a 0%, #ff8c2f 100%)",
                boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
              }}
            >
              {isLoading ? "Loading..." : "Send Request"}
            </button>

            <div className="text-xs" style={{ color: "rgba(255,228,181,0.75)" }}>
              Note: This calls your backend (`/api/astrology/*`). Your Prokerala credentials stay on the server.
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-extrabold" style={{ color: "#FFE4B5" }}>
              Response
            </div>

            {error && (
              <pre
                className="rounded-xl p-3 text-xs overflow-auto"
                style={{
                  background: "rgba(120, 20, 10, 0.35)",
                  border: "1px solid rgba(255, 90, 80, 0.4)",
                  color: "#FFE4B5",
                  maxHeight: "55vh",
                }}
              >
                {JSON.stringify(error, null, 2)}
              </pre>
            )}

            {!error && (
              <pre
                className="rounded-xl p-3 text-xs overflow-auto"
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255, 140, 50, 0.35)",
                  color: "#FFF1D6",
                  maxHeight: "55vh",
                }}
              >
                {response ? JSON.stringify(response, null, 2) : "No response yet."}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
