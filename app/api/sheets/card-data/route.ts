import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { saveCardSubmission, saveCardConfig, readCardSheetLayout } from '@/lib/card-sheets';

/** GET — read-only sync: returns the card tab's latest layout from the Sheet */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cardId = req.nextUrl.searchParams.get('cardId');
  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 });
  }

  try {
    const tabs = await readCardSheetLayout(cardId.toUpperCase());
    return NextResponse.json({ tabs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to read sheet' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { type, cardId, user, rows, filter, duration, supervisor } = await req.json();
    if (!cardId || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (type === 'config') {
      if (session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      await saveCardConfig(cardId, rows);
    } else {
      await saveCardSubmission(
        cardId,
        user || session.email,
        rows,
        filter || '',
        duration || '',
        session.name || '',
        supervisor || '',
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    );
  }
}
