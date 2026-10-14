import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ensureCardTabs } from '@/lib/card-sheets';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await ensureCardTabs();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create tabs' },
      { status: 500 },
    );
  }
}
