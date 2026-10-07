'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FIELDS } from '@/config/fields';
import type { FieldRange } from '@/lib/range-utils';

export function RangeSettings() {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const [ranges, setRanges] = useState<Record<string, FieldRange>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setRanges(data.ranges || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ranges }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      toast.success(t('admin.rangeSaveSuccess'));
    } catch {
      toast.error(t('admin.rangeSaveError'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.rangeSettings')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{t('admin.rangeSettingsDesc')}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => {
            const r = ranges[f.key] || { min: 0, max: 0 };
            return (
              <div key={f.key} className="flex flex-col gap-2">
                <Label>{f.label[locale]}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={r.min}
                    onChange={(e) =>
                      setRanges({ ...ranges, [f.key]: { ...r, min: Number(e.target.value) } })
                    }
                    className="w-24"
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="number"
                    value={r.max}
                    onChange={(e) =>
                      setRanges({ ...ranges, [f.key]: { ...r, max: Number(e.target.value) } })
                    }
                    className="w-24"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={handleSave} disabled={saving} className="min-w-32">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save />}
            {t('common.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
