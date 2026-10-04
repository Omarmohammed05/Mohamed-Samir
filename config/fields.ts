export type FieldConfig = {
  key: 'a' | 'b' | 'c' | 'd';
  label: { en: string; ar: string };
};

export const FIELDS: FieldConfig[] = [
  { key: 'a', label: { en: 'Task', ar: 'المهمة' } },
  { key: 'b', label: { en: 'Progress', ar: 'التقدم' } },
  { key: 'c', label: { en: 'Blockers', ar: 'المعوقات' } },
  { key: 'd', label: { en: 'Notes', ar: 'ملاحظات' } },
];

export function fieldLabel(key: string, locale: 'en' | 'ar'): string {
  const f = FIELDS.find((x) => x.key === key);
  return f ? f.label[locale] : key;
}
