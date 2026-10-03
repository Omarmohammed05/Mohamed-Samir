import type { Session } from './auth';

/**
 * Permissions module — all checks are server-side only.
 * The client never decides role or identity.
 */

export function canReadEntry(session: Session, entryUser: string): boolean {
  if (session.role === 'admin') return true;
  return session.email.toLowerCase() === entryUser.toLowerCase();
}

export function canWriteEntry(session: Session, entryUser: string): boolean {
  if (session.role === 'admin') return false; // admin edits in Sheets, not on the site
  return session.email.toLowerCase() === entryUser.toLowerCase();
}

export function canDeleteEntry(session: Session, entryUser: string): boolean {
  if (session.role === 'admin') return false;
  return session.email.toLowerCase() === entryUser.toLowerCase();
}

export function isAdmin(session: Session | null): boolean {
  return session?.role === 'admin';
}

export function isUser(session: Session | null): boolean {
  return session?.role === 'user';
}

export function assertUser(session: Session | null): asserts session is Session {
  if (!session) throw new PermissionError('Not authenticated');
}

export function assertAdmin(session: Session | null): asserts session is Session {
  if (!session || session.role !== 'admin') throw new PermissionError('Admin access required');
}

export class PermissionError extends Error {
  status = 403;
}
