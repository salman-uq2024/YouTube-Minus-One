'use client';

import { useState } from 'react';

export const metadata = {
  title: 'Compliance – YouTube Minus One'
};

export default function CompliancePage() {
  const [cleared, setCleared] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 text-sm text-white/70">
      <h1 className="text-2xl font-semibold text-white">Compliance</h1>
      <ul className="list-disc space-y-2 pl-6">
        <li>Metadata comes exclusively from the official YouTube Data API v3.</li>
        <li>Playback uses only the official YouTube IFrame Player with branding, controls, and ads intact.</li>
        <li>No downloads, background playback, ad blocking, or UI overlays are provided.</li>
        <li>Shorts (videos 60 seconds or shorter) are excluded purely via duration-based filtering.</li>
      </ul>
      <p>
        Clear your local preferences and recent searches at any time. This removes only browser-stored data; no
        accounts exist on our servers.
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.removeItem('ym1-settings');
          localStorage.removeItem('ym1-recent');
          setCleared(true);
        }}
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black hover:bg-white"
      >
        Clear local settings
      </button>
      {cleared ? <p className="text-xs text-white/50">Preferences cleared.</p> : null}
    </div>
  );
}
