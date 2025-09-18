export const metadata = {
  title: 'Privacy – YouTube Minus One'
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 text-sm text-white/70">
      <h1 className="text-2xl font-semibold text-white">Privacy Notice</h1>
      <p>
        We do not collect personal accounts or store user profiles. The app keeps lightweight preferences—region,
        language, and recent searches—in your browser’s localStorage so you can clear them at any time via the
        compliance page. Optional anonymous analytics events may be sent to understand feature usage; no personal data
        or video playback information is transmitted.
      </p>
      <p>
        All video data is fetched from YouTube’s official API. Playback occurs within the official IFrame Player, which
        may show ads controlled by YouTube. By using this app you also agree to YouTube’s Privacy Policy.
      </p>
    </div>
  );
}
