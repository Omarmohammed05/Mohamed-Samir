import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllCards } from '@/lib/cards-store';
import { cardTotal } from '@/lib/cards-types';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const cards = await getAllCards();
  return NextResponse.json({
    cards: cards.map((c) => ({
      code: c.code,
      itemCount: c.items.length,
      total: cardTotal(c.items),
      updatedAt: c.updatedAt,
    })),
  });
}
