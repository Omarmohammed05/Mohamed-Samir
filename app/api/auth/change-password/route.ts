import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { changePasswordSchema } from '@/lib/validators';
import { MOCK_USERS, normalizeRole } from '@/config/mock-users';
import { invalidateAll } from '@/lib/cache';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 },
    );
  }

  const { currentPassword, newPassword } = parsed.data;
  const isReal = process.env.SHEETS_MODE === 'real';

  try {
    if (isReal) {
      // Update password in Google Sheets Users tab
      const { updateUser } = await import('@/lib/users');
      // Verify current password
      const { listUsers } = await import('@/lib/users');
      const users = await listUsers();
      const user = users.find((u) => u.email === session.email.toLowerCase().trim());
      if (!user || user.password !== currentPassword) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
      await updateUser(session.email, { password: newPassword });
    } else {
      // Mock mode — verify against mock users
      const user = MOCK_USERS.find((u) => u.email === session.email.toLowerCase().trim());
      if (!user || user.password !== currentPassword) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
      // In mock mode, we can't persist password changes to the static config,
      // but we can update the in-memory copy
      user.password = newPassword;
    }

    invalidateAll();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to change password' },
      { status: 500 },
    );
  }
}
