import { NavLink, Outlet } from "react-router-dom";

const linkBase =
  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition";
const linkIdle =
  "bg-white/5 text-amber-100 hover:bg-white/10 hover:text-amber-50";
const linkActive = "bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/30";

export default function AstrologyLayout() {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at 15% 10%, rgba(255, 190, 110, 0.14) 0%, rgba(0, 0, 0, 0) 40%), radial-gradient(circle at 85% 20%, rgba(255, 120, 45, 0.18) 0%, rgba(0, 0, 0, 0) 45%), linear-gradient(180deg, rgba(44, 16, 8, 1) 0%, rgba(16, 6, 3, 1) 100%)",
      }}
    >
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <NavLink
              to="/"
              className={`${linkBase} ${linkIdle}`}
              title="Back to Home"
            >
              ← Home
            </NavLink>
            <div className="text-lg font-black tracking-wide text-amber-100">
              Astrology
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            <NavLink
              to="/panchang"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkIdle}`
              }
            >
              Panchang
            </NavLink>
            <NavLink
              to="/kundali"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkIdle}`
              }
            >
              Kundali
            </NavLink>
            <NavLink
              to="/matchmaking"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkIdle}`
              }
            >
              Matchmaking
            </NavLink>
            <NavLink
              to="/muhurat"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkIdle}`
              }
            >
              Muhurat
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
