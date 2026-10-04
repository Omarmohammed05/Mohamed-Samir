export type MockUser = {
  email: string;
  name: string;
  role: 'user' | 'admin';
  password: string;
};

export const MOCK_USERS: MockUser[] = [
  { email: 'admin@team.com', name: 'Admin', role: 'admin', password: 'admin123' },
  { email: 'sara@team.com', name: 'Sara Ahmed', role: 'user', password: 'user123' },
  { email: 'omar@team.com', name: 'Omar Hassan', role: 'user', password: 'user123' },
  { email: 'layla@team.com', name: 'Layla Mostafa', role: 'user', password: 'user123' },
  { email: 'karim@team.com', name: 'Karim Tarek', role: 'user', password: 'user123' },
];
