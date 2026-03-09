import PageShell from "./PageShell";

export default function AboutPage() {
  return (
    <PageShell title="About & Legal">
      <div className="grid gap-4 max-w-4xl mx-auto pb-8">
        {/* App Info & Description */}
        <section className="app-surface rounded-3xl p-5 md:p-6 text-amber-50 shadow-lg">
          <div className="text-lg md:text-xl font-black text-amber-400 border-b border-amber-500/30 pb-3 mb-3">About Hindu Calendar</div>
          <div className="text-sm md:text-base text-amber-100/90 leading-relaxed space-y-3">
            <p>Built as a comprehensive Hindu calendar dashboard with Prokerala-backed astrology endpoints for highly accurate calculations.</p>
            <p>Access Panchang, festivals, muhurat, kundali, matchmaking, and more. Data is fetched securely and optimized for performance.</p>
          </div>
        </section>

        {/* Tips Section */}
        <section className="app-surface rounded-3xl p-5 md:p-6 text-amber-50 shadow-lg">
          <div className="text-lg md:text-xl font-black text-amber-400 border-b border-amber-500/30 pb-3 mb-3">Tips for Best Use</div>
          <ul className="list-disc pl-5 text-sm md:text-base text-amber-100/90 leading-relaxed space-y-2">
            <li><strong>Location Accuracy:</strong> Set your location in the Settings menu to ensure accurate sunrise and tithi calculations for your timezone.</li>
            <li><strong>Calendar Navigation:</strong> Use the Month View for broad calendar navigation and high-level phase overviews.</li>
            <li><strong>Hindu Time:</strong> The Hindu Time screen displays traditional Ghati, Pal, and Vipal passing since your local sunrise.</li>
          </ul>
        </section>

        {/* Terms and Conditions */}
        <section className="app-surface rounded-3xl p-5 md:p-6 text-amber-50 shadow-lg">
          <div className="text-lg md:text-xl font-black text-amber-400 border-b border-amber-500/30 pb-3 mb-3">Terms & Conditions</div>
          <div className="text-sm md:text-base text-amber-100/90 leading-relaxed space-y-3">
            <p>By using this application, you agree to these terms. The app is provided "as is" and without warranties of any kind.</p>
            <p>You agree to use this application for personal, non-commercial purposes only. Any unauthorized scraping, circumvention of security, or abuse of the app's services is strictly prohibited.</p>
            <p>We reserve the right to modify these terms at any time. Continued use of the application confirms your acceptance of any changes.</p>
          </div>
        </section>

        {/* Privacy Policy */}
        <section className="app-surface rounded-3xl p-5 md:p-6 text-amber-50 shadow-lg">
          <div className="text-lg md:text-xl font-black text-amber-400 border-b border-amber-500/30 pb-3 mb-3">Privacy Policy</div>
          <div className="text-sm md:text-base text-amber-100/90 leading-relaxed space-y-3">
            <p>We respect your privacy. This application does not collect, store, or transmit unnecessary personal data.</p>
            <p>Location data (if provided) is used strictly locally or sent securely to our astrology endpoints solely to calculate accurate, location-based astronomical data like sunrise and tithi. It is not tracked, stored, or sold to third parties.</p>
            <p>Application preferences (such as your chosen language and location settings) are stored locally on your device.</p>
          </div>
        </section>

        {/* Disclaimers & Contact */}
        <section className="app-surface rounded-3xl p-5 md:p-6 text-amber-50 shadow-lg border border-red-500/20 bg-gradient-to-br from-black/20 to-red-900/10">
          <div className="text-lg md:text-xl font-black text-amber-400 border-b border-amber-500/30 pb-3 mb-3">Data Disclaimer & Feedback</div>
          <div className="text-sm md:text-base text-amber-100/90 leading-relaxed space-y-3">
            <p><strong>Informational Purposes Only:</strong> The calendar, astrological data, horoscopes, and time calculations provided by this application are sourced from third-party public APIs and astronomical algorithms. We <strong>do not guarantee</strong> the absolute accuracy, completeness, or reliability of this data.</p>
            <p>The developer and company are <strong>not responsible or liable</strong> in any way for any decisions, actions, or consequences resulting from the use of the information furnished by this app. Users must exercise their own judgment and consult relevant domain experts when necessary.</p>
            <p className="mt-4 pt-4 border-t border-amber-500/20">
              If you believe any data is incorrect, misleading, or bugged, we welcome your feedback to help us improve.
              <br /><br />
              <strong>Contact Us:</strong> <a href="mailto:[Contact Email]" className="text-amber-300 underline hover:text-white transition-colors">[Contact Email]</a>
              <br />
              <strong>Developer:</strong> [Company Name]
            </p>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
