'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { EntryStatus } from '@/lib/entry-store';

const STATUS_STYLES: Record<EntryStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Operator: 'secondary',
  Supervisor: 'default',
  Engineer: 'outline',
};

const STATUS_COLORS: Record<EntryStatus, string> = {
  Operator: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Supervisor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Engineer: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

export function StatusBadge({ status }: { status: EntryStatus }) {
  const t = useTranslations('status');
  const label = t(status.toLowerCase() as 'operator' | 'supervisor' | 'engineer');
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {label}
    </span>
  );
}
