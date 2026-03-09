const labels = {
  en: {
    settings: 'Language Settings',
    language: 'Select Language',
    info: 'Choose your chatbot language.',
  },
  te: {
    settings: 'భాష సెట్టింగ్స్',
    language: 'భాషను ఎంచుకోండి',
    info: 'చాట్‌బాట్ కోసం భాషను ఎంచుకోండి.',
  },
  hi: {
    settings: 'भाषा सेटिंग्स',
    language: 'भाषा चुनें',
    info: 'चैटबॉट के लिए भाषा चुनें।',
  },
};

function getL(language) {
  return labels[language] || labels.en;
}

export default function SettingsPanel({ settings, onSettingsChange, onClose }) {
  const l = getL(settings.language);

  const updateSetting = (key, value) => {
    onSettingsChange((prev) => ({ ...prev, [key]: value }));
    if (key === 'language') {
      onClose();
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 space-y-6 bg-gradient-to-b from-orange-50/50 to-white">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold text-gray-800">{l.settings}</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-orange-100">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
        <label className="text-sm font-medium text-gray-700 mb-3 block">{l.language}</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { code: 'te', label: 'తెలుగు' },
            { code: 'en', label: 'English' },
            { code: 'hi', label: 'हिंदी' },
          ].map((lang) => (
            <button
              key={lang.code}
              onClick={() => updateSetting('language', lang.code)}
              className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                settings.language === lang.code
                  ? 'bg-gradient-to-br from-orange-500 to-yellow-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-orange-50'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
        <div className="flex items-start gap-3">
          <i className="ri-information-line text-orange-500 text-lg mt-0.5"></i>
          <p className="text-xs text-gray-600 leading-relaxed">{l.info}</p>
        </div>
      </div>
    </div>
  );
}
