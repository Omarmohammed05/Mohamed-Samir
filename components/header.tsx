'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { LogOut, Menu } from 'lucide-react';
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

  // Navigation items per role
  const navItems: { label: string; href: string }[] = [];
  // All roles see Cards
  navItems.push({ label: t('nav.cards'), href: '/cards' });
  // All roles see History
  navItems.push({ label: t('nav.history'), href: '/history' });
  // Supervisor and Engineer see Review
  if (session.role === 'supervisor' || session.role === 'engineer' || session.role === 'admin') {
    navItems.push({ label: t('nav.review'), href: '/review' });
  }
  // Admin sees Admin dashboard
  if (session.role === 'admin') {
    navItems.push({ label: t('nav.admin'), href: '/admin' });
  }
  // All roles see Settings
  navItems.push({ label: t('nav.settings'), href: '/settings' });

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
              {navItems.map((item) => (
                <DropdownMenuItem key={item.href} onClick={() => router.push(item.href)}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1 me-2">
            {navItems.map((item) => (
              <Button key={item.href} variant="ghost" size="sm" onClick={() => router.push(item.href)}>
                {item.label}
              </Button>
            ))}
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
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{session.name}</span>
                  <span className="text-xs text-muted-foreground">{session.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('userMenu.role')}: {t(`users.${session.role}`)}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                {t('common.changePassword')}
              </DropdownMenuItem>
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
