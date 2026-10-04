'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * "Installation Beacon" — a floating button that appears when the browser
 * signals the app is installable (beforeinstallprompt). Clicking it triggers
 * the native install dialog. Hidden when the app is already installed or the
 * prompt is unavailable (e.g. inside a cross-origin iframe).
 */
export function InstallAppButton() {
  const t = useTranslations('pwa');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already installed (running standalone) — nothing to do.
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const installed = () => setDeferred(null);

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  if (!deferred) return null;

  const onClick = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('installApp')}
      className="fixed bottom-5 end-5 z-50 flex items-center gap-2 rounded-full bg-[#0057FF] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0057FF]/30 transition hover:bg-[#0046cc] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-[#0057FF]"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {t('installApp')}
    </button>
  );
}
