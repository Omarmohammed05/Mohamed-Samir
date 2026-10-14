export type CardItem = { id: string; label: string; amount: number };
export type CardData = { code: string; items: CardItem[]; updatedAt: string };

/** F01 .. F26 */
export const CARD_CODES: string[] = Array.from({ length: 26 }, (_, i) =>
  'F' + String(i + 1).padStart(2, '0'),
);

export function cardTotal(items: CardItem[]): number {
  return items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
}
