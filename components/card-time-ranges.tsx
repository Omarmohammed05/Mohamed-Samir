'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Save, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CARD_TABS } from '@/config/cards';
import type { CardTimeRange } from '@/lib/card-config';

export function CardTimeRanges() {
  const t = useTranslations();
  const [config, setConfig] = useState<Record<string, CardTimeRange>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recoloring, setRecoloring] = useState(false);

  useEffect(() => {
    fetch('/api/card-config')
      .then((r) => r.json())
      .then((data) => setConfig(data.config || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/card-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      toast.success(t('admin.cardRangesSaved'));
    } catch {
      toast.error(t('admin.cardRangesSaveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRecolor() {
    setRecoloring(true);
    try {
      const res = await fetch('/api/card-config/recolor', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success(t('admin.recolorDone'));
    } catch {
      toast.error(t('admin.recolorError'));
    } finally {
      setRecoloring(false);
    }
  }

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.cardTimeRanges')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{t('admin.cardTimeRangesDesc')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
          {CARD_TABS.map((tab) => {
            const r = config[tab] || { min_seconds: 0, max_seconds: 0 };
            return (
              <div key={tab} className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
                <Label className="text-xs font-bold">{tab}</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={r.min_seconds}
                    onChange={(e) =>
                      setConfig({ ...config, [tab]: { ...r, min_seconds: Number(e.target.value) } })
                    }
                    className="w-full text-xs"
                    placeholder="min"
                  />
                  <span className="text-muted-foreground text-xs">—</span>
                  <Input
                    type="number"
                    value={r.max_seconds}
                    onChange={(e) =>
                      setConfig({ ...config, [tab]: { ...r, max_seconds: Number(e.target.value) } })
                    }
                    className="w-full text-xs"
                    placeholder="max"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={handleRecolor} disabled={recoloring}>
            {recoloring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t('admin.recolorExisting')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('common.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
