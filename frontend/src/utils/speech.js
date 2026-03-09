let voicesLoaded = false;
let availableVoices = [];

function loadVoices() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      availableVoices = voices;
      voicesLoaded = true;
      resolve(voices);
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        availableVoices = window.speechSynthesis.getVoices();
        voicesLoaded = true;
        resolve(availableVoices);
      };
    }
  });
}

function getVoiceForLanguage(lang) {
  return availableVoices.find(v => v.lang === lang) ||
         availableVoices.find(v => v.lang.startsWith(lang.split("-")[0])) ||
         null;
}

export async function speakText(text, language = "en") {
  if (!window.speechSynthesis || !text) return;

  await loadVoices();

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  const langMap = {
    en: "en-US",
    te: "te-IN",
    hi: "hi-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    ta: "ta-IN",
  };

  const langCode = langMap[language] || "en-US";
  utterance.lang = langCode;

  const selectedVoice = getVoiceForLanguage(langCode);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.rate = 0.9;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}
