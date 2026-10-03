'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { FIELDS } from '@/config/fields';
import type { Entry } from '@/lib/mock-store';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  knownUsers: { email: string; name: string }[];
  editingEntry: Entry | null;
  defaultDate: string;
};

export function AdminEntryDialog({ open, onOpenChange, knownUsers, editingEntry, defaultDate }: Props) {
  const t = useTranslations('entries');
  const tc = useTranslations('common');
  const ta = useTranslations('admin');
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();

  const [user, setUser] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [fields, setFields] = useState({ a: '', b: '', c: '', d: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setUser(editingEntry?.user || knownUsers[0]?.email || '');
      setDate(editingEntry?.date || defaultDate);
      setFields({
        a: editingEntry?.a || '',
        b: editingEntry?.b || '',
        c: editingEntry?.c || '',
        d: editingEntry?.d || '',
      });
      setErrors({});
    }
  }, [open, editingEntry, defaultDate, knownUsers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!user) errs.user = ta('user');
    if (!date) errs.date = t('date');
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
        body: JSON.stringify({ date, user, ...fields }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      toast.success(t('saveSuccess'));
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(t('saveError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingEntry ? t('editTitle') : ta('addEntry')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-user">{ta('user')}</Label>
              <Select value={user} onValueChange={setUser}>
                <SelectTrigger id="admin-user">
                  <SelectValue placeholder={ta('allUsers')} />
                </SelectTrigger>
                <SelectContent>
                  {knownUsers.map((u) => (
                    <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.user && <span className="text-xs text-destructive">{errors.user}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-date">{t('date')}</Label>
              <Input
                id="admin-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {errors.date && <span className="text-xs text-destructive">{errors.date}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-2">
                <Label htmlFor={`admin-${f.key}`}>{f.label[locale]}</Label>
                <Textarea
                  id={`admin-${f.key}`}
                  value={fields[f.key]}
                  onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                  maxLength={1000}
                  rows={2}
                  className={errors[f.key] ? 'border-destructive' : ''}
                />
                {errors[f.key] && (
                  <span className="text-xs text-destructive">{errors[f.key]}</span>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
