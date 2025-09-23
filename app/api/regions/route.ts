import { NextResponse } from 'next/server';
import { getI18nRegions } from '@/lib/youtube';

export async function GET() {
  try {
    const regions = await getI18nRegions();
    return NextResponse.json({ regions });
  } catch (error) {
    console.error('[YM1][REGIONS]', {
      event: 'SERVER_ERROR',
      error: error instanceof Error ? error.message : error
    });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
