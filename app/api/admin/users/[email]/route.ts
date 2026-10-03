import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertAdmin } from '@/lib/permissions';
import { updateUser, deleteUser } from '@/lib/users';
import { userUpdateSchema } from '@/lib/validators';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> },
) {
  const session = await getSession();
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || 'Invalid input' },
      { status: 400 },
    );
  }

  try {
    const user = await updateUser(decodeURIComponent(email), parsed.data);
    return NextResponse.json({
      user: { email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ email: string }> },
) {
  const session = await getSession();
  try {
    assertAdmin(session);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email } = await params;

  try {
    const deleted = await deleteUser(decodeURIComponent(email));
    if (!deleted) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
