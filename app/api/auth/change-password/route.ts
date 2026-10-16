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
      const { listUsers, verifyPassword } = await import('@/lib/users');
      const users = await listUsers();
      const user = users.find((u) => u.email === session.email.toLowerCase().trim());
      if (!user || !verifyPassword(currentPassword, user.password)) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
      await updateUser(session.email, { password: newPassword });
    } else {
      // Mock/excel mode — verify against mock users (with persistent overrides)
      const { verifyMockPassword, setPasswordOverride } = await import('@/lib/password-store');
      const user = MOCK_USERS.find((u) => u.email === session.email.toLowerCase().trim());
      if (!user || !(await verifyMockPassword(user, currentPassword))) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
      // Persist the new password so the login route bundle sees it
      await setPasswordOverride(session.email, newPassword);
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
