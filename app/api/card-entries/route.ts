import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createEntry, listEntriesForCard, listPendingEntries, listRecentEntries } from '@/lib/entry-store';
import { cardEntryCreateSchema } from '@/lib/validators';
import { canCreateEntry, assertAuthenticated, canViewHistory } from '@/lib/permissions';
import { saveCardSubmission } from '@/lib/card-sheets';
import type { UserRole } from '@/config/mock-users';

/** GET — list entries (pending for reviewer role, or recent for history) */
export async function GET(req: NextRequest) {
  const session = await getSession();
  try {
    assertAuthenticated(session);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const filter = url.searchParams.get('filter');
  const cardId = url.searchParams.get('cardId');

  try {
    if (filter === 'pending') {
      const entries = await listPendingEntries(session.role as UserRole);
      return NextResponse.json({ entries });
    }
    if (filter === 'history') {
      if (!canViewHistory(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const entries = await listRecentEntries(4);
      return NextResponse.json({ entries });
    }
    if (cardId) {
      const entries = await listEntriesForCard(cardId);
      return NextResponse.json({ entries });
    }
    // Default: pending for role
    const entries = await listPendingEntries(session.role as UserRole);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error('[card-entries GET] Error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

/** POST — create a new card entry (operator/supervisor/admin only) */
export async function POST(req: NextRequest) {
  const session = await getSession();
  try {
    assertAuthenticated(session);
    if (!canCreateEntry(session)) {
      return NextResponse.json({ error: 'Engineers cannot create entries' }, { status: 403 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unauthorized' },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = cardEntryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 },
    );
  }

  const { card_id, rows, duration_seconds, filter } = parsed.data;

  try {
    // Create the entry in the store
    const entry = await createEntry({
      card_id,
      rows,
      user_email: session.email,
      user_name: session.name,
      user_role: session.role as UserRole,
      duration_seconds: duration_seconds ?? null,
    });

    // Also write to the card tab in Google Sheets (existing behavior),
    // including the operator's fill-in duration and display name
    const durationText =
      duration_seconds != null
        ? `${Math.floor(duration_seconds / 60)}m ${duration_seconds % 60}s`
        : '';
    try {
      await saveCardSubmission(card_id, session.email, rows, filter || '', durationText, session.name || '');
    } catch (err) {
      // Non-fatal: the card tab write is supplementary
      console.error('[card-entries POST] Card tab sync failed:', err instanceof Error ? err.message : 'unknown');
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    console.error('[card-entries POST] Error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 });
  }
}
