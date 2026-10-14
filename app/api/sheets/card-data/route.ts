import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { saveCardData } from '@/lib/card-sheets';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { cardId, rows } = await req.json();
    if (!cardId || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    await saveCardData(cardId, rows);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    );
  }
}
