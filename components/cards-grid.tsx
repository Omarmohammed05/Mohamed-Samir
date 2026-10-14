'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import type { CardData } from '@/lib/cards-types';
import { cardTotal } from '@/lib/cards-types';

type Props = {
  cards: CardData[];
};

export function CardsGrid({ cards }: Props) {
  const t = useTranslations('cards');

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {cards.map((card) => {
        const total = cardTotal(card.items);
        return (
          <Link key={card.code} href={`/cards/${card.code}`}>
            <Card className="transition-colors hover:border-primary hover:bg-accent/50">
              <CardContent className="flex flex-col items-center justify-center gap-1 p-5 text-center">
                <span className="text-2xl font-bold tracking-tight">
                  {card.code}
                </span>
                <span className="text-xs text-muted-foreground">
                  {card.items.length} {t('items')}
                </span>
                {total > 0 && (
                  <span className="text-sm font-medium text-primary">
                    {t('total')}: {total.toLocaleString()}
                  </span>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
