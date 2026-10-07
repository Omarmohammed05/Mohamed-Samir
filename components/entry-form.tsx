'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Save, Loader2, AlertTriangle } from 'lucide-react';
import { isOutOfRange, type FieldRange } from '@/lib/range-utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FIELDS } from '@/config/fields';
import type { Entry } from '@/lib/mock-store';

type Props = {
  todayDate: string;
  existingEntry: Entry | null;
};

export function EntryForm({ todayDate, existingEntry }: Props) {
  const t = useTranslations('entries');
  const tc = useTranslations('common');
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const [date, setDate] = useState(existingEntry?.date || todayDate);
  const [fields, setFields] = useState({
    a: existingEntry?.a || '',
    b: existingEntry?.b || '',
    c: existingEntry?.c || '',
    d: existingEntry?.d || '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ranges, setRanges] = useState<Record<string, FieldRange>>({});

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setRanges(data.ranges || {}))
      .catch(() => {});
  }, []);

  const isEdit = !!existingEntry;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const f of FIELDS) {
      if (!fields[f.key].trim()) errs[f.key] = t('fieldsRequired');
      else if (fields[f.key].length > 1000) errs[f.key] = t('maxChars');
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, ...fields }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      toast.success(t('saveSuccess'));
      const outOfRange = FIELDS.filter(
        (f) => ranges[f.key] && isOutOfRange(fields[f.key], ranges[f.key]),
      );
      if (outOfRange.length > 0) {
        toast.warning(t('entries.rangeWarningToast'));
      }
      router.refresh();
    } catch {
      toast.error(t('saveError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>{isEdit ? t('editTitle') : t('todayTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">{t('date')}</Label>
            <Input
              id="date"
              type="date"
              value={date}
              max={todayDate}
              onChange={(e) => setDate(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-2">
                <Label htmlFor={f.key}>{f.label[locale]}</Label>
                <Textarea
                  id={f.key}
                  value={fields[f.key]}
                  onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                  maxLength={1000}
                  rows={2}
                  className={errors[f.key] ? 'border-destructive' : ''}
                />
                {errors[f.key] && (
                  <span className="text-xs text-destructive">{errors[f.key]}</span>
                )}
                {ranges[f.key] && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {t('entries.rangeHint', { min: ranges[f.key].min, max: ranges[f.key].max })}
                    </span>
                    {isOutOfRange(fields[f.key], ranges[f.key]) && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                        <AlertTriangle className="h-3 w-3" />
                        {t('entries.rangeWarning', { min: ranges[f.key].min, max: ranges[f.key].max })}
                      </span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading} className="min-w-32">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('saveSuccess').replace('successfully', '…')}
                </>
              ) : (
                <>
                  <Save />
                  {tc('save')}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
