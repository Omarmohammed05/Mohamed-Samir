export type UserRole = 'operator' | 'supervisor' | 'engineer' | 'admin';

export type MockUser = {
  email: string;
  name: string;
  role: UserRole;
  password: string;
};

export const MOCK_USERS: MockUser[] = [
  { email: 'admin@team.com', name: 'Admin', role: 'admin', password: 'admin123' },
  { email: 'sara@team.com', name: 'Sara Ahmed', role: 'supervisor', password: 'user123' },
  { email: 'omar@team.com', name: 'Omar Hassan', role: 'operator', password: 'user123' },
  { email: 'layla@team.com', name: 'Layla Mostafa', role: 'engineer', password: 'user123' },
  { email: 'karim@team.com', name: 'Karim Tarek', role: 'operator', password: 'user123' },
];

/** Map legacy 'user' role to 'operator' for backward compatibility. */
export function normalizeRole(role: string): UserRole {
  if (role === 'user') return 'operator';
  if (['operator', 'supervisor', 'engineer', 'admin'].includes(role)) {
    return role as UserRole;
  }
  return 'operator';
}
