import { Navigate, Route, Routes } from "react-router-dom";
import App from "./App";
import HomePage from "./HomePage";
import AstrologyHome from "./astrology/AstrologyHome";
import KundaliPage from "./astrology/KundaliPage";
import MatchmakingPage from "./astrology/MatchmakingPage";
import MuhuratPage from "./astrology/MuhuratPage";
import PanchangPage from "./astrology/PanchangPage";
import AutoTranslator from "./components/AutoTranslator";
import AboutPage from "./pages/AboutPage";
import CompassPage from "./pages/CompassPage";
import DevotionalMusicPage from "./pages/DevotionalMusicPage";
import FestivalsPage from "./pages/FestivalsPage";
import HinduTimePage from "./pages/HinduTimePage";
import MantrasPosterPage from "./pages/MantrasPosterPage";
import MyTithiPage from "./pages/MyTithiPage";
import PanchangPosterPage from "./pages/PanchangPosterPage";
import ParchmentPreviewPage from "./pages/ParchmentPreviewPage";
import SankalpMantraPage from "./pages/SankalpMantraPage";
import SettingsPage from "./pages/SettingsPage";

export default function RouterApp() {
  return (
    <>
      <AutoTranslator />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/month-view" element={<App />} />
        <Route path="/festivals" element={<FestivalsPage />} />
        <Route path="/my-tithi" element={<MyTithiPage />} />
        <Route path="/hindu-time" element={<HinduTimePage />} />
        <Route path="/compass" element={<CompassPage />} />
        <Route path="/panchang-poster" element={<PanchangPosterPage />} />
        <Route path="/parchment-preview" element={<ParchmentPreviewPage />} />
        <Route path="/mantras-poster" element={<MantrasPosterPage />} />
        <Route path="/devotional-music" element={<DevotionalMusicPage />} />
        <Route path="/sankalp-mantra" element={<SankalpMantraPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route path="/astrology" element={<AstrologyHome />} />
        <Route path="/kundali" element={<KundaliPage />} />
        <Route path="/matchmaking" element={<MatchmakingPage />} />
        <Route path="/muhurat" element={<MuhuratPage />} />
        <Route path="/panchang" element={<PanchangPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
