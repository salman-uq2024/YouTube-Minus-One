import { describe, expect, it } from 'vitest';
import { filterOutShorts, isShort, parseISO8601DurationToSeconds } from '@/lib/duration';

describe('duration utilities', () => {
  it('parses ISO durations into seconds', () => {
    expect(parseISO8601DurationToSeconds('PT5M12S')).toBe(312);
    expect(parseISO8601DurationToSeconds('PT1H1M1S')).toBe(3661);
  });

  it('identifies shorts based on threshold', () => {
    expect(isShort(60)).toBe(true);
    expect(isShort(61)).toBe(false);
  });

  it('filters out shorts from results', () => {
    const items = [
      { id: '1', durationSec: 45 },
      { id: '2', durationSec: 100 },
      { id: '3', durationSec: 61 }
    ];
    const filtered = filterOutShorts(items);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((item) => item.id)).toEqual(['2', '3']);
  });
});
