import { getMetricsSnapshot } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export default function UsageAdminPage() {
  const metrics = getMetricsSnapshot();
  const { cache, rateLimit, dataApiCalls, quota } = metrics;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Usage telemetry</h1>
        <p className="text-sm text-white/60">
          Generated at {metrics.generatedAt}. Last reset {metrics.lastReset}.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-surface/70 p-6">
          <h2 className="text-lg font-semibold">Cache</h2>
          <dl className="mt-4 space-y-2 text-sm text-white/70">
            <div className="flex justify-between">
              <dt>Hits</dt>
              <dd>{cache.hits}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Misses</dt>
              <dd>{cache.misses}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Stores</dt>
              <dd>{cache.stores}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Joins</dt>
              <dd>{cache.joins}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Errors</dt>
              <dd>{cache.errors}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface/70 p-6">
          <h2 className="text-lg font-semibold">Rate limit</h2>
          <dl className="mt-4 space-y-2 text-sm text-white/70">
            <div className="flex justify-between">
              <dt>Total checks</dt>
              <dd>{rateLimit.requests}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Blocks</dt>
              <dd>{rateLimit.hits}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Bypasses</dt>
              <dd>{rateLimit.bypasses}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Quota cooling</dt>
              <dd>{quota.coolingEvents}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-surface/70 p-6">
        <h2 className="text-lg font-semibold">Data API calls</h2>
        <table className="mt-4 w-full table-fixed text-left text-sm text-white/70">
          <thead className="text-white/60">
            <tr>
              <th className="w-2/3 border-b border-white/10 pb-2">Endpoint</th>
              <th className="w-1/3 border-b border-white/10 pb-2 text-right">Count</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(dataApiCalls).length === 0 ? (
              <tr>
                <td colSpan={2} className="py-3 text-center text-white/50">
                  No calls recorded yet.
                </td>
              </tr>
            ) : (
              Object.entries(dataApiCalls).map(([endpoint, count]) => (
                <tr key={endpoint} className="border-b border-white/5 last:border-0">
                  <td className="py-2 font-medium text-white">{endpoint}</td>
                  <td className="py-2 text-right">{count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
