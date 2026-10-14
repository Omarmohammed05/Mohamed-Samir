'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import type { CardData, CardItem } from '@/lib/cards-types';
import { cardTotal } from '@/lib/cards-types';

type Props = {
  card: CardData;
};

export function CardDetail({ card }: Props) {
  const t = useTranslations('cards');
  const tc = useTranslations('common');
  const router = useRouter();
  const [items, setItems] = useState<CardItem[]>(card.items);
  const [loading, setLoading] = useState(false);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: '', amount: 0 },
    ]);
  }

  function updateItem(id: string, patch: Partial<CardItem>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch(`/api/cards/${card.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      toast.success(t('saveSuccess'));
      router.refresh();
    } catch {
      toast.error(t('saveError'));
    } finally {
      setLoading(false);
    }
  }

  const total = cardTotal(items);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/cards">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Button>
        </Link>
        <span className="text-3xl font-bold tracking-tight">{card.code}</span>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('items')}</CardTitle>
          <span className="text-sm font-medium text-primary">
            {t('total')}: {total.toLocaleString()}
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t('empty')}
            </p>
          )}

          {items.map((it, idx) => (
            <div key={it.id} className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor={`label-${it.id}`} className="text-xs">
                  {t('label')} {idx + 1}
                </Label>
                <Input
                  id={`label-${it.id}`}
                  value={it.label}
                  placeholder={t('labelPlaceholder')}
                  onChange={(e) => updateItem(it.id, { label: e.target.value })}
                />
              </div>
              <div className="flex w-28 flex-col gap-1">
                <Label htmlFor={`amount-${it.id}`} className="text-xs">
                  {t('amount')}
                </Label>
                <Input
                  id={`amount-${it.id}`}
                  type="number"
                  value={it.amount}
                  onChange={(e) =>
                    updateItem(it.id, { amount: Number(e.target.value) })
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => removeItem(it.id)}
                aria-label={tc('delete')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex justify-between pt-2">
            <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
              <Plus className="h-4 w-4" />
              {t('add')}
            </Button>
            <Button onClick={handleSave} disabled={loading} className="gap-1">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {tc('save')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
