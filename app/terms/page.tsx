export const metadata = {
  title: 'Terms – YouTube Minus One'
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 text-sm text-white/70">
      <h1 className="text-2xl font-semibold text-white">Terms of Use</h1>
      <p>
        YouTube Minus One provides discovery and playback of YouTube videos exclusively through the official YouTube
        Data API and IFrame Player API. By using this app you agree to follow YouTube’s Terms of Service and
        applicable laws. We do not grant any rights to download, redistribute, or commercially exploit YouTube
        content. Do not attempt to use the app for scraping, automated bulk activity, or any purpose that violates
        YouTube policies.
      </p>
      <p>
        All playback occurs in the official player with controls, ads, and branding intact. If you need to stop using
        the app you can close the browser window; no account is required.
      </p>
    </div>
  );
}
