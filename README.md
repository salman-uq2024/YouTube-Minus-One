# YouTube Minus One

Discover YouTube’s best long-form videos without the noise of Shorts. YouTube Minus One lets you search, explore, and watch using the official YouTube Data API and IFrame Player—no scraping, no downloads, no ad blocking. Designed for Vercel, it keeps costs near zero on day one while staying ready to scale if traffic spikes.

> _Screenshots coming soon._

## How Shorts are excluded
Shorts are identified strictly by duration. Every search or recommendation first fetches candidate IDs, then requests `videos.list` with `contentDetails`. Any video with a duration of 60 seconds or less (`PT60S`) is filtered out before it reaches the UI.

## Strict Compliance
- Don’t scrape or extract video streams.
- Don’t block or modify ads or the official player UI.
- Don’t offer downloads, audio-only, or background playback.
- Use only the official YouTube Data API v3 and IFrame Player API for metadata and playback.

## Getting started
1. Create a `.env.local` file from `.env.example` and set `YT_API_KEY`. Optionally configure Upstash Redis credentials for distributed caching and rate limiting.
2. Install dependencies with `npm install`.
3. Run the development server with `npm run dev` and open http://localhost:3000.

Deploy on [Vercel](https://vercel.com/):
- Add the same environment variables to your project.
- Enable edge caching / ISR (revalidation is already configured for explore pages).
- Set a production `NEXT_PUBLIC_APP_NAME` if you want to customize branding.

## Cost and scaling notes
- YouTube API responses are cached for six hours via Upstash Redis when available, or in-memory otherwise.
- Batched `videos.list` calls minimize quota usage.
- Incremental Static Regeneration powers the Explore page to keep traffic light.
- Optional Redis-backed rate limiting shields the API from abuse and preserves quota.
- Graceful handling of quota exhaustion informs users without crashing the app.

## Privacy
We don’t run accounts or collect personal information. Settings (region, language, minimum duration) and recent searches live only in your browser’s localStorage. Clear them anytime from the Compliance page. Optional anonymous analytics hooks can be added without storing PII.

## Acceptance tests
- Searching “Jazz” shows videos at least 61 seconds long.
- Opening a video uses the official IFrame Player and playback works with ads intact.
- Related videos under the player exclude Shorts.
- Quota exhaustion shows a friendly error and the app remains navigable.
- No network calls expose the YouTube API key in the browser.
