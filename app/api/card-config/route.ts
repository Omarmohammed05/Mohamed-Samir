import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCardConfig, saveCardConfig } from '@/lib/card-config';
import { cardConfigSchema } from '@/lib/validators';
import { assertAdmin } from '@/lib/permissions';
import { CARD_TABS } from '@/config/cards';

/** GET — card time ranges (admin only) */
export async function GET() {
  const session = await getSession();
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const config = await getCardConfig();
  return NextResponse.json({ config });
}

/** PUT — update card time ranges (admin only) */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = cardConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 },
    );
  }

  // Ensure all cards are present
  const config = { ...parsed.data.config };
  for (const tab of CARD_TABS) {
    if (!config[tab]) {
      config[tab] = { min_seconds: 0, max_seconds: 0 };
    }
  }

  await saveCardConfig(config);
  return NextResponse.json({ config });
}
