'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { CardInputRow } from '@/config/card-data';

export type ContainerEditValues = {
  tagNo: string;
  description: string;
  unit: string;
  min: string;
  norm: string;
  max: string;
  group: string;
};

export function ContainerEditDialog({
  open,
  onOpenChange,
  row,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: CardInputRow | null;
  onSave: (values: ContainerEditValues) => void;
}) {
  const t = useTranslations('cards');
  const [tagNo, setTagNo] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [min, setMin] = useState('');
  const [norm, setNorm] = useState('');
  const [max, setMax] = useState('');
  const [group, setGroup] = useState('');

  useEffect(() => {
    if (row) {
      setTagNo(row.tagNo);
      setDescription(row.description);
      setUnit(row.unit);
      setMin(row.min);
      setNorm(row.norm);
      setMax(row.max);
      setGroup(row.group || '');
    }
  }, [row]);

  function handleSave() {
    onSave({
      tagNo: tagNo.trim(),
      description: description.trim(),
      unit: unit.trim(),
      min: min.trim(),
      norm: norm.trim(),
      max: max.trim(),
      group: group.trim(),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editContainer')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ce-tag">{t('tagNo')}</Label>
            <Input id="ce-tag" value={tagNo} onChange={(e) => setTagNo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ce-desc">{t('description')}</Label>
            <Input id="ce-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ce-unit">{t('unit')}</Label>
            <Input id="ce-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ce-min">{t('min')}</Label>
              <Input id="ce-min" value={min} onChange={(e) => setMin(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ce-norm">{t('norm')}</Label>
              <Input id="ce-norm" value={norm} onChange={(e) => setNorm(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ce-max">{t('max')}</Label>
              <Input id="ce-max" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ce-group">{t('group')}</Label>
            <Input
              id="ce-group"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder={t('groupPlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave}>{t('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
