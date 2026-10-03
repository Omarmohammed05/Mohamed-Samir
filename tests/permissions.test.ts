import { describe, it, expect } from 'vitest';
import { canReadEntry, canWriteEntry, canDeleteEntry, isAdmin, PermissionError, assertUser, assertAdmin } from '@/lib/permissions';
import type { Session } from '@/lib/auth';

const user: Session = { email: 'sara@team.com', role: 'user', name: 'Sara' };
const admin: Session = { email: 'admin@team.com', role: 'admin', name: 'Admin' };
const otherUser: Session = { email: 'omar@team.com', role: 'user', name: 'Omar' };

describe('permissions', () => {
  describe('canReadEntry', () => {
    it('allows user to read own entries', () => {
      expect(canReadEntry(user, 'sara@team.com')).toBe(true);
    });
    it('denies user from reading other user entries', () => {
      expect(canReadEntry(user, 'omar@team.com')).toBe(false);
    });
    it('allows admin to read any entry', () => {
      expect(canReadEntry(admin, 'sara@team.com')).toBe(true);
      expect(canReadEntry(admin, 'omar@team.com')).toBe(true);
    });
  });

  describe('canWriteEntry', () => {
    it('allows user to write own entries', () => {
      expect(canWriteEntry(user, 'sara@team.com')).toBe(true);
    });
    it('denies user from writing other user entries', () => {
      expect(canWriteEntry(user, 'omar@team.com')).toBe(false);
    });
    it('denies admin from writing (admin edits in Sheets)', () => {
      expect(canWriteEntry(admin, 'sara@team.com')).toBe(false);
    });
  });

  describe('canDeleteEntry', () => {
    it('allows user to delete own entries', () => {
      expect(canDeleteEntry(user, 'sara@team.com')).toBe(true);
    });
    it('denies user from deleting other user entries', () => {
      expect(canDeleteEntry(user, 'omar@team.com')).toBe(false);
    });
    it('denies admin from deleting', () => {
      expect(canDeleteEntry(admin, 'sara@team.com')).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('returns true for admin session', () => expect(isAdmin(admin)).toBe(true));
    it('returns false for user session', () => expect(isAdmin(user)).toBe(false));
    it('returns false for null session', () => expect(isAdmin(null)).toBe(false));
  });

  describe('assertUser', () => {
    it('passes for authenticated user', () => {
      expect(() => assertUser(user)).not.toThrow();
    });
    it('throws for null session', () => {
      expect(() => assertUser(null)).toThrow(PermissionError);
    });
  });

  describe('assertAdmin', () => {
    it('passes for admin', () => {
      expect(() => assertAdmin(admin)).not.toThrow();
    });
    it('throws for non-admin user', () => {
      expect(() => assertAdmin(user)).toThrow(PermissionError);
    });
    it('throws for null session', () => {
      expect(() => assertAdmin(null)).toThrow(PermissionError);
    });
  });

  describe('case insensitivity', () => {
    it('handles mixed-case emails', () => {
      expect(canReadEntry(user, 'SARA@team.com')).toBe(true);
      expect(canWriteEntry(user, 'Sara@Team.COM')).toBe(true);
    });
  });
});
