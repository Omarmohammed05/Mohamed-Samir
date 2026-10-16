import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEntry, updateEntry, type CardEntry } from '@/lib/entry-store';
import { cardEntryUpdateSchema } from '@/lib/validators';
import { assertAuthenticated, canEditEntry, canApproveAtStatus } from '@/lib/permissions';
import { updateCardSubmissionReview } from '@/lib/card-sheets';
import type { UserRole } from '@/config/mock-users';

/** GET — single entry by ID */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  try {
    assertAuthenticated(session);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }
  return NextResponse.json({ entry });
}

/** PUT — edit an entry (edit values or approve) */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  try {
    assertAuthenticated(session);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const entry = await getEntry(id);
  if (!entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;

  // ─── Approve action ──────────────────────────────
  if (action === 'approve') {
    if (!canApproveAtStatus(session, entry.status)) {
      return NextResponse.json({ error: 'You cannot approve this entry' }, { status: 403 });
    }
    const now = new Date().toISOString();
    const updates: Partial<CardEntry> = {
      last_edited_by: session.name,
      last_edited_at: now,
    };

    if (entry.status === 'Operator') {
      // Supervisor approval → moves to Engineer
      updates.status = 'Supervisor';
      updates.supervisor_name = session.name;
      updates.supervisor_approved_at = now;
    } else if (entry.status === 'Supervisor') {
      // Engineer approval → final
      updates.status = 'Engineer';
      updates.engineer_name = session.name;
      updates.engineer_approved_at = now;
    }

    // If editing values before approving
    if (body.rows) {
      updates.rows = body.rows as string[][];
    }

    const updated = await updateEntry(id, updates);

    // Sync the reviewer's name to the card tab in Google Sheets
    // (supplementary — the CardEntries store is the source of truth).
    if (updated) {
      const reviewRole = entry.status === 'Operator' ? 'supervisor' : 'engineer';
      try {
        await updateCardSubmissionReview(
          updated.card_id,
          updated.operator_name,
          updated.created_at,
          session.name,
          reviewRole,
        );
      } catch (err) {
        console.error('[card-entries PUT] Card tab review sync failed:', err instanceof Error ? err.message : 'unknown');
      }
    }

    return NextResponse.json({ entry: updated });
  }

  // ─── Edit action (values only) ───────────────────
  if (!canEditEntry(session, entry)) {
    return NextResponse.json({ error: 'You cannot edit this entry' }, { status: 403 });
  }

  const parsed = cardEntryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const updated = await updateEntry(id, {
    ...parsed.data,
    last_edited_by: session.name,
    last_edited_at: now,
  });

  return NextResponse.json({ entry: updated });
}
