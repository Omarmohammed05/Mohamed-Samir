import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listEntries } from '@/lib/sheets';
import { FIELDS } from '@/config/fields';
import { assertAdmin } from '@/lib/permissions';

export async function GET() {
  const session = await getSession();
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { entries } = await listEntries();

  const headers = ['Date', 'User', ...FIELDS.map((f) => f.label.en), 'UpdatedAt'];
  const rows = entries.map((e) =>
    [e.date, e.user, e.a, e.b, e.c, e.d, e.updatedAt]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  const csv = [headers.join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="entries-export.csv"`,
    },
  });
}
