const DEBUG_ENABLED = process.env.YM1_DEBUG === '1';

export function isDebugEnabled(): boolean {
  return DEBUG_ENABLED;
}

export function debugLog(tag: string, payload: unknown) {
  if (!DEBUG_ENABLED) return;
  console.info(`[YM1][${tag}]`, payload);
}
