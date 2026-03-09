let currentAudio = null;
let audioContext = null;
let currentResolve = null;
let activeRequestId = 0;

// Use env, works in dev & production (Vercel/Netlify/etc)
const API_BASE = import.meta.env.VITE_API_BASE_URL;

// Initialize audio context on first user interaction
export function initAudioContext() {
  if (!audioContext && typeof window !== "undefined") {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      audioContext = new Ctx();
      console.log("Audio context initialized");
    }
  }
}

/**
 * Core play function. Ensures:
 * - any previous audio stops before new starts
 * - caller can await completion and know if interrupted
 */
export async function speakCloud(text, language) {
  if (!text || !language) return;

  initAudioContext();

  // Stop any currently playing audio and resolve pending playback promise.
  stopSpeech();
  const requestId = ++activeRequestId;

  try {
    const res = await fetch(`${API_BASE}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });

    if (!res.ok) {
      console.error("TTS HTTP error", res.status);
      return { interrupted: true };
    }

    const data = await res.json();
    if (!data.audio) return { interrupted: true };
    if (requestId !== activeRequestId) return { interrupted: true };

    currentAudio = new Audio("data:audio/mp3;base64," + data.audio);

    return new Promise((resolve) => {
      if (requestId !== activeRequestId) {
        resolve({ interrupted: true });
        return;
      }
      currentResolve = resolve;

      const finish = (interrupted = false) => {
        if (currentResolve) {
          currentResolve({ interrupted });
          currentResolve = null;
        }
        currentAudio = null;
      };

      currentAudio.onended = () => finish(false);
      currentAudio.onerror = () => finish(true);

      const playPromise = currentAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.log("Audio blocked by browser (needs user interaction):", err);
          finish(true);
        });
      }
    });
  } catch (error) {
    console.error("Speech error:", error);
    if (currentResolve) {
      currentResolve({ interrupted: true });
      currentResolve = null;
    }
    currentAudio = null;
    return { interrupted: true };
  }
}

export function stopSpeech() {
  activeRequestId += 1;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  currentAudio = null;

  if (currentResolve) {
    currentResolve({ interrupted: true });
    currentResolve = null;
  }
}
