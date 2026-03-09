import { useState } from "react";

function ControlButton({ label, onClick, large = false, icon = null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full font-bold text-[#ffe4be] transition hover:scale-105 active:scale-95 ${
        large ? "h-16 w-16 text-2xl leading-none" : "h-11 w-11 text-xs"
      }`}
      style={{
        background: large
          ? "linear-gradient(180deg, #b34a17 0%, #7a220c 100%)"
          : "linear-gradient(180deg, #f2a544 0%, #ca5f14 58%, #8b2e0d 100%)",
        border: large ? "2px solid rgba(245,162,85,0.95)" : "2px solid rgba(248,177,94,0.92)",
        boxShadow: large
          ? "0 10px 20px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,196,130,0.45), inset 0 -2px 0 rgba(86,23,7,0.65)"
          : "0 6px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,225,166,0.62), inset 0 -1px 0 rgba(108,34,10,0.7)",
        textShadow: "0 1px 2px rgba(0,0,0,0.7)",
      }}
    >
      {icon === "play" ? (
        <span
          className="inline-block ml-1 border-y-[11px] border-y-transparent border-l-[18px] border-l-[#ffd9a2]"
          aria-hidden="true"
        />
      ) : null}
      {icon === "pause" ? (
        <span className="inline-flex items-center gap-1.5" aria-hidden="true">
          <span className="h-6 w-1.5 rounded-sm bg-[#ffd9a2]" />
          <span className="h-6 w-1.5 rounded-sm bg-[#ffd9a2]" />
        </span>
      ) : null}
      {icon === "prev" ? (
        <span className="inline-flex items-center gap-1" aria-hidden="true">
          <span className="inline-block border-y-[5px] border-y-transparent border-r-[8px] border-r-[#f6c470]" />
          <span className="inline-block border-y-[5px] border-y-transparent border-r-[8px] border-r-[#f6c470]" />
        </span>
      ) : null}
      {icon === "next" ? (
        <span className="inline-flex items-center gap-1" aria-hidden="true">
          <span className="inline-block border-y-[5px] border-y-transparent border-l-[8px] border-l-[#f6c470]" />
          <span className="inline-block border-y-[5px] border-y-transparent border-l-[8px] border-l-[#f6c470]" />
        </span>
      ) : null}
      {!icon ? label : null}
    </button>
  );
}

export default function DevotionalMusicPage() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="min-h-screen p-2 sm:p-4 md:p-6 flex items-center justify-center bg-[#4a0f1b]">
      <main
        className="relative w-full max-w-[430px] md:max-w-[560px] aspect-[9/16] max-h-[92vh] rounded-xl overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(28,6,2,0.22), rgba(28,6,2,0.4)), url('/devotion.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: "0 30px 90px rgba(0,0,0,0.72)",
          filter: "brightness(1.04) saturate(1.08)",
        }}
      >
        <section className="absolute inset-x-[8%] sm:inset-x-[10%] md:inset-x-[7%] top-[3.5%] bottom-[5%] flex flex-col">
          <div
            className="mx-auto w-[78%] sm:w-[72%] rounded-2xl px-3 py-1.5 text-center"
            style={{
              background: "linear-gradient(180deg, #8a2a12 0%, #5f180b 100%)",
              border: "2px solid rgba(255,190,105,0.62)",
              boxShadow: "0 8px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,219,169,0.25)",
            }}
          >
            <h1 className="text-[22px] sm:text-[24px] font-bold text-[#ffe8be] [text-shadow:0_2px_4px_rgba(0,0,0,0.62)]">
              Devotional Music
            </h1>
          </div>

          <div className="mt-auto">
            <div
              className="mx-auto w-[92%] sm:w-[86%] rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-center"
              style={{
                background: "linear-gradient(180deg, rgba(94,27,8,0.84) 0%, rgba(60,14,6,0.9) 100%)",
                border: "2px solid rgba(255,168,82,0.48)",
                boxShadow: "0 10px 22px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,206,140,0.28)",
              }}
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#ffd9a5]/85">Now Playing</p>
              <h2 className="mt-1 text-[#ffe4be] text-[17px] sm:text-[18px] font-semibold leading-tight">
                Mangalam Ganesha
              </h2>
              <p className="mt-0.5 text-[#ffcb8a] text-[12px]">Instrumental Bhajan</p>

              <div className="mt-3 sm:mt-4 flex items-center justify-center gap-3 sm:gap-4">
                <ControlButton icon="prev" label="" onClick={() => {}} />
                <ControlButton
                  large
                  icon={isPlaying ? "pause" : "play"}
                  label=""
                  onClick={() => setIsPlaying((value) => !value)}
                />
                <ControlButton icon="next" label="" onClick={() => {}} />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

