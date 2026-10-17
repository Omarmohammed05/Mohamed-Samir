import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { saveCardSubmission, saveCardConfig, readCardSheetData, backfillContainerIds } from '@/lib/card-sheets';
import { mergeCardData, emptySheetData, CARD_DATA } from '@/lib/card-merge';
import { isValidCardId } from '@/config/cards';

export const dynamic = 'force-dynamic';

/** Fresh card layout for the Sync button / entry auto-fetch. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cardId = (req.nextUrl.searchParams.get('cardId') || '').toUpperCase();
  if (!isValidCardId(cardId)) {
    return NextResponse.json({ error: 'Invalid card' }, { status: 400 });
  }

  let sheetData = emptySheetData();
  try {
    sheetData = await readCardSheetData(cardId);
    // Additive ID migration, same as the page render path
    if (sheetData.containers.some((c) => !c.id)) {
      await backfillContainerIds(cardId);
      sheetData = await readCardSheetData(cardId);
    }
  } catch {
    // Tab doesn't exist or Sheets API unavailable — merge falls back to defaults
  }

  const tabs = mergeCardData(CARD_DATA[cardId] || [], sheetData);
  return NextResponse.json({ tabs });
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
