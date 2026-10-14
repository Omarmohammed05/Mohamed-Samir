'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { LogOut, User as UserIcon, ChevronDown, Menu } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';
import { AccessibilitySettings } from './accessibility-settings';
import type { Session } from '@/lib/auth';

export function Header({ session }: { session: Session }) {
  const t = useTranslations();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h8" />
            </svg>
          </div>
          <span className="hidden sm:inline text-lg font-semibold tracking-tight">
            {t('common.appName')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Mobile nav menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => router.push('/cards')}>
                {t('nav.cards')}
              </DropdownMenuItem>
              {session.role === 'admin' && (
                <>
                  <DropdownMenuItem onClick={() => router.push('/entries')}>
                    {t('nav.myEntries')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/admin')}>
                    {t('nav.admin')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1 me-2">
            <Button variant="ghost" size="sm" onClick={() => router.push('/cards')}>
              {t('nav.cards')}
            </Button>
            {session.role === 'admin' && (
              <>
                <Button variant="ghost" size="sm" onClick={() => router.push('/entries')}>
                  {t('nav.myEntries')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => router.push('/admin')}>
                  {t('nav.admin')}
                </Button>
              </>
            )}
          </nav>
          <LanguageSwitcher />
          <AccessibilitySettings />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 sm:gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                  {session.name.charAt(0).toUpperCase()}
                </span>
                <ChevronDown className="hidden sm:block h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{session.name}</span>
                  <span className="text-xs text-muted-foreground">{session.email}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {t('userMenu.role')}: {session.role}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut />
                <span>{t('common.logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
