import { Link } from "react-router-dom";

export default function PageShell({ title, right, children }) {
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        background:
          "radial-gradient(circle at 15% 10%, rgba(255, 190, 110, 0.14) 0%, rgba(0, 0, 0, 0) 40%), radial-gradient(circle at 85% 20%, rgba(255, 120, 45, 0.18) 0%, rgba(0, 0, 0, 0) 45%), linear-gradient(180deg, rgba(44, 16, 8, 1) 0%, rgba(16, 6, 3, 1) 100%)",
      }}
    >
      <header className="sticky top-0 z-20 px-4 pt-3">
        <div
          className="mx-auto w-full max-w-6xl min-w-0 rounded-xl p-2 backdrop-blur-md"
          style={{
            background:
              "linear-gradient(135deg, rgba(80, 20, 10, 0.98) 0%, rgba(100, 25, 12, 0.95) 50%, rgba(120, 30, 15, 0.92) 100%)",
            border: "3px solid rgba(255, 140, 50, 0.8)",
            boxShadow:
              "0 0 30px rgba(255, 140, 50, 0.6), 0 0 60px rgba(255, 100, 30, 0.45), inset 0 0 24px rgba(255, 140, 50, 0.18)",
          }}
        >
          <div
            className="grid grid-cols-[40px_1fr_40px] items-center gap-3 rounded-xl px-2 py-2"
            style={{
              background:
                "linear-gradient(135deg, #d84315 0%, #e64a19 15%, #ff6f00 35%, #ff8f00 50%, #ff6f00 65%, #e64a19 85%, #d84315 100%)",
              border: "1.5px solid rgba(255, 183, 77, 0.5)",
              boxShadow:
                "0 4px 20px rgba(255, 111, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 rgba(139, 69, 19, 0.3)",
            }}
          >
            <Link
              to="/"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-amber-100 transition hover:scale-105"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255, 224, 130, 0.3) 0%, rgba(255, 183, 77, 0.25) 100%)",
                border: "1px solid rgba(255, 224, 130, 0.3)",
              }}
              aria-label="Back"
              title="Back"
            >
              {"<"}
            </Link>
            <div
              className="text-center text-lg font-black tracking-wide"
              style={{
                color: "#FFF9F0",
                textShadow: "0 2px 8px rgba(255, 183, 77, 0.6), 0 0 20px rgba(255, 152, 0, 0.3)",
              }}
            >
              {title}
            </div>
            <div className="min-w-[40px] justify-self-end">{right}</div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl min-w-0 px-4 py-4">{children}</main>
    </div>
  );
}
