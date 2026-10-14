/** 26 card tab IDs: F01, F02, … F26 */
export const CARD_TABS: string[] = Array.from(
  { length: 26 },
  (_, i) => `F${String(i + 1).padStart(2, '0')}`,
);

/** True when id is one of F01–F26 (case-insensitive). */
export function isValidCardId(id: string): boolean {
  return CARD_TABS.includes(id.toUpperCase());
}
