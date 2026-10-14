import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCard, saveCard } from '@/lib/cards-store';
import type { CardItem } from '@/lib/cards-types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { code } = await params;
  const card = await getCard(code);
  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }
  return NextResponse.json({ card });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.pathname.split('/').pop() || '';
  const body = await req.json().catch(() => ({}));
  const items: CardItem[] = Array.isArray(body.items) ? body.items : [];

  // basic validation
  for (const it of items) {
    if (typeof it.label !== 'string' || it.label.length > 200) {
      return NextResponse.json({ error: 'Invalid label' }, { status: 400 });
    }
  }

  try {
    const card = await saveCard(code, items);
    return NextResponse.json({ card });
  } catch {
    return NextResponse.json({ error: 'Invalid card code' }, { status: 400 });
  }
}
