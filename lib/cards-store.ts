import fs from 'fs/promises';
import path from 'path';
import { CARD_CODES, type CardData, type CardItem } from './cards-types';

const FILE =
  process.env.CARDS_FILE_PATH || path.join(process.cwd(), 'data', 'cards.json');

let cache: Record<string, CardData> | null = null;
let mutex: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = mutex.then(() => fn());
  mutex = result.then(() => undefined, () => undefined);
  return result as Promise<T>;
}

async function load(): Promise<Record<string, CardData>> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(FILE, 'utf-8');
    cache = JSON.parse(raw) as Record<string, CardData>;
  } catch {
    cache = {};
  }
  return cache;
}

async function persist(data: Record<string, CardData>): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), 'utf-8');
  cache = data;
}

function isValidCode(code: string): boolean {
  return CARD_CODES.includes(code.toUpperCase());
}

export async function getAllCards(): Promise<CardData[]> {
  const data = await load();
  return CARD_CODES.map(
    (code) => data[code] || { code, items: [], updatedAt: '' },
  );
}

export async function getCard(code: string): Promise<CardData | null> {
  const upper = code.toUpperCase();
  if (!isValidCode(upper)) return null;
  const data = await load();
  return data[upper] || { code: upper, items: [], updatedAt: '' };
}

export async function saveCard(
  code: string,
  items: CardItem[],
): Promise<CardData> {
  return withLock(async () => {
    const upper = code.toUpperCase();
    if (!isValidCode(upper)) throw new Error('Invalid card code');
    const data = await load();
    const card: CardData = {
      code: upper,
      items: items.map((it) => ({
        id: it.id || crypto.randomUUID(),
        label: it.label,
        amount: Number(it.amount) || 0,
      })),
      updatedAt: new Date().toISOString(),
    };
    data[upper] = card;
    await persist(data);
    return card;
  });
}
