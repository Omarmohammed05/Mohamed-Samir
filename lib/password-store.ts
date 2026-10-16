/**
 * Persistent password overrides for mock/excel auth modes.
 *
 * In `next dev` each route handler is its own compiled bundle, so an
 * in-memory mutation of MOCK_USERS in the change-password route is not
 * visible to the login route. Password changes in non-real modes are
 * persisted to this JSON file so both routes read the same value.
 * Real (Google Sheets) mode does not use this file.
 */
import { promises as fs } from 'fs';
import path from 'path';

const OVERRIDES_PATH = path.join(process.cwd(), 'data', 'password-overrides.json');

export async function getPasswordOverrides(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(OVERRIDES_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function setPasswordOverride(email: string, password: string): Promise<void> {
  const overrides = await getPasswordOverrides();
  overrides[email.toLowerCase().trim()] = password;
  await fs.mkdir(path.dirname(OVERRIDES_PATH), { recursive: true });
  await fs.writeFile(OVERRIDES_PATH, JSON.stringify(overrides, null, 2), 'utf-8');
}

/**
 * Verify a password for a mock/excel-mode user: persistent override first,
 * then the seed value from config/mock-users.ts.
 */
export async function verifyMockPassword(
  user: { email: string; password: string },
  password: string,
): Promise<boolean> {
  const overrides = await getPasswordOverrides();
  const override = overrides[user.email.toLowerCase().trim()];
  const current = override !== undefined ? override : user.password;
  return current === password;
}
