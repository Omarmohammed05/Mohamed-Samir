import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { saveCardSubmission, saveCardConfig } from '@/lib/card-sheets';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { type, cardId, user, rows, filter } = await req.json();
    if (!cardId || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (type === 'config') {
      if (session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      await saveCardConfig(cardId, rows);
    } else {
      await saveCardSubmission(cardId, user || session.email, rows, filter || '');
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    );
  }
}
