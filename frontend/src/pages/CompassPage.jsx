import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { tr } from "../translations";
import PageShell from "./PageShell";

function normalizeDeg(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return ((n % 360) + 360) % 360;
}

const DIR8 = [
  { short: "N", local: "Uttara", deg: 0 },
  { short: "NE", local: "Ishan", deg: 45 },
  { short: "E", local: "Purva", deg: 90 },
  { short: "SE", local: "Agneya", deg: 135 },
  { short: "S", local: "Dakshin", deg: 180 },
  { short: "SW", local: "Nairitya", deg: 225 },
  { short: "W", local: "Paschim", deg: 270 },
  { short: "NW", local: "Vayavya", deg: 315 },
];

function directionFrom(angle) {
  if (angle == null) return "-";
  const idx = Math.round(angle / 45) % 8;
  const d = DIR8[idx];
  return `${d.short} • ${d.local}`;
}

/**
 * Returns the compass heading (0 = North, 90 = East, 180 = South, 270 = West)
 * from a DeviceOrientationEvent.
 *
 * webkit:  webkitCompassHeading directly gives true compass heading.
 * Android: When absolute=true, alpha is the angle from North (clockwise when
 *          viewed from above), so heading = 360 - alpha (because alpha increases
 *          counter-clockwise).
 *          When absolute=false (arbitrary reference frame), we cannot compute
 *          true North — return null so the user knows sensor is unavailable.
 */
function headingFromEvent(e) {
  // iOS Safari gives a direct compass heading (degrees from North, clockwise)
  if (typeof e.webkitCompassHeading === "number" && e.webkitCompassHeading >= 0) {
    return normalizeDeg(e.webkitCompassHeading);
  }
  // Android / Chrome with deviceorientationabsolute
  if (typeof e.alpha === "number" && e.absolute === true) {
    // alpha increases counter-clockwise when viewed from above, so compass heading is:
    return normalizeDeg(360 - e.alpha);
  }
  // Relative orientation only (no absolute heading available)
  return null;
}

export default function CompassPage() {
  const { language } = useLanguage();

  const [heading, setHeading] = useState(null);
  const [status, setStatus] = useState(tr("compassEnableTitle", "Tap Enable to start.", language));
  const [enabled, setEnabled] = useState(false);

  // We use a ref-based low-pass filter to smooth jitter without React re-renders.
  const smoothRef = useRef(null);
  const isNativeRef = useRef(false);
  const frameIdRef = useRef(null);

  useEffect(() => {
    // Tell native app to start sending compass data if the bridge exists
    if (window.CompassControl && window.CompassControl.postMessage) {
      try {
        window.CompassControl.postMessage('start');
      } catch (e) {
        console.error("Failed to start native compass", e);
      }
    }

    window.updateNativeCompass = (nativeHeading) => {
      if (!isNativeRef.current) {
        isNativeRef.current = true;
        setStatus(tr("compassActiveNative", "Compass active (Native Sensor).", language));
        setEnabled(true);
      }

      const next = normalizeDeg(nativeHeading);
      if (next == null) return;

      if (smoothRef.current == null) {
        smoothRef.current = next;
      } else {
        let delta = next - smoothRef.current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        smoothRef.current = ((smoothRef.current + delta * 0.3) % 360 + 360) % 360;
      }

      if (frameIdRef.current) return;
      frameIdRef.current = requestAnimationFrame(() => {
        frameIdRef.current = null;
        setHeading(Math.round(smoothRef.current));
      });
    };

    return () => {
      delete window.updateNativeCompass;
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      // Tell native app to stop sending compass data
      if (window.CompassControl && window.CompassControl.postMessage) {
        try {
          window.CompassControl.postMessage('stop');
        } catch (e) {
          console.error("Failed to stop native compass", e);
        }
      }
    };
  }, []);

  const directionText = useMemo(() => directionFrom(heading), [heading]);

  const enable = async () => {
    try {
      if (!window.isSecureContext) {
        setStatus(tr("compassErrorHttps", "Compass needs HTTPS (or localhost). Open this on a secure URL.", language));
        return;
      }
      if (typeof window.DeviceOrientationEvent === "undefined") {
        setStatus(tr("compassErrorDevice", "Device orientation is not supported on this device/browser.", language));
        return;
      }
      setStatus(tr("compassStarting", "Starting…", language));

      // iOS 13+ requires explicit permission request for DeviceOrientation.
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        const p = await DeviceOrientationEvent.requestPermission();
        if (p !== "granted") {
          setStatus(tr("compassErrorPermission", "Permission denied. Please allow motion access in Settings.", language));
          return;
        }
      }

      smoothRef.current = null;
      setEnabled(true);
      setStatus(tr("compassCalibrateMsg", "Move your phone in a figure-8 to calibrate.", language));
    } catch (e) {
      setStatus(e?.message || "Failed to start compass.");
    }
  };

  useEffect(() => {
    if (!enabled) return;

    let gotReading = false;
    let frameId = null;

    const handler = (e) => {
      if (isNativeRef.current) return; // Native sensor override
      const next = headingFromEvent(e);
      if (next == null) return;
      gotReading = true;

      // Low-pass filter: blend towards new reading using shortest angular path.
      if (smoothRef.current == null) {
        smoothRef.current = next;
      } else {
        // Shortest-path delta to avoid wrap-around jumps.
        let delta = next - smoothRef.current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        smoothRef.current = ((smoothRef.current + delta * 0.3) % 360 + 360) % 360;
      }

      // Batch state updates to animation frames to avoid rapid re-renders.
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        setHeading(Math.round(smoothRef.current));
        setStatus(tr("compassActive", "Compass active.", language));
      });
    };

    // Prefer absolute orientation (gives true North on Android Chrome)
    window.addEventListener("deviceorientationabsolute", handler, true);
    window.addEventListener("deviceorientation", handler, true);

    const timeout = window.setTimeout(() => {
      if (!gotReading && !isNativeRef.current) {
        setStatus(
          tr("compassErrorTimeout", "No sensor data received. Please enable Motion & Orientation access in your browser or device settings.", language)
        );
      }
    }, 3000);

    return () => {
      window.clearTimeout(timeout);
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener("deviceorientationabsolute", handler, true);
      window.removeEventListener("deviceorientation", handler, true);
    };
  }, [enabled]);

  // The compass rose (dial) rotates so that N always points to actual North.
  // The fixed red pointer at the top of the circle always indicates the
  // direction the phone is facing. So: when heading=90 (facing East), the
  // rose rotates -90° so that E is at the top under the pointer.
  const dialRotation = heading != null ? -heading : 0;

  return (
    <PageShell
      title={tr("compassTitle", "Compass", language)}
      right={
        <button
          type="button"
          onClick={enable}
          className="rounded-xl bg-amber-400/15 px-3 py-2 text-xs font-black text-amber-100 ring-1 ring-amber-300/25 hover:bg-amber-400/20"
        >
          {enabled ? tr("compassRecalibrateBtn", "Recalibrate", language) : tr("compassEnableBtn", "Enable", language)}
        </button>
      }
    >
      <div className="grid gap-4">
        <section className="app-surface rounded-3xl p-5 text-amber-50">
          <div className="text-sm font-black text-amber-100">{tr("compassHeading", "Heading", language)}</div>
          <div className="mt-1 text-4xl font-black text-amber-50">
            {heading == null ? "-" : `${heading}°`}
          </div>
          <div className="mt-1 text-base font-black text-amber-100">{directionText}</div>
          <div className="mt-2 text-sm text-amber-100/70">{status}</div>
        </section>

        <section className="app-surface mx-auto w-full max-w-sm rounded-3xl p-5">
          <div className="relative mx-auto h-72 w-72">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border border-amber-300/25 bg-gradient-to-b from-amber-300/10 to-black/30 shadow-[0_30px_70px_rgba(0,0,0,0.55)]" />
            <div className="absolute inset-4 rounded-full border border-amber-300/15 bg-black/20" />

            {/* Rotating compass rose — N label rotates with it, stays at true North */}
            <div
              className="absolute inset-0"
              style={{
                transform: `rotate(${dialRotation}deg)`,
                transition: "transform 0.15s linear",
              }}
            >
              {/* Tick marks */}
              {Array.from({ length: 36 }).map((_, i) => {
                const major = i % 3 === 0;
                return (
                  <div
                    key={`tick-${i}`}
                    className={`absolute left-1/2 top-3 origin-bottom ${major ? "h-4 w-[2px]" : "h-2.5 w-[1px]"}`}
                    style={{
                      transform: `translateX(-50%) rotate(${i * 10}deg)`,
                      background: major
                        ? "rgba(255, 210, 130, 0.6)"
                        : "rgba(255, 210, 130, 0.35)",
                    }}
                  />
                );
              })}

              {/* Cardinal labels — these rotate WITH the dial, so N is always at true North */}
              <div className="absolute left-1/2 top-1.5 -translate-x-1/2 text-xs font-black tracking-[0.2em] text-red-400">
                N
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black tracking-[0.2em] text-amber-100/80">
                E
              </div>
              <div className="absolute left-1/2 bottom-1.5 -translate-x-1/2 text-xs font-black tracking-[0.2em] text-amber-100/80">
                S
              </div>
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-black tracking-[0.2em] text-amber-100/80">
                W
              </div>
            </div>

            {/* Fixed pointer — always points UP (= direction phone faces) */}
            <div className="absolute left-1/2 top-[18px] -translate-x-1/2 text-red-400 z-10">▲</div>

            {/* Needle pointing North (toward top of screen when facing North) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full z-10">
              <div className="h-28 w-[6px] rounded-full bg-amber-200 shadow-[0_0_20px_rgba(255,210,130,0.45)]" />
            </div>
            <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/70 bg-amber-200 z-10" />
          </div>
        </section>
      </div>
    </PageShell>
  );
}
