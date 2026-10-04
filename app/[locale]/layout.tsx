import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Inter, Cairo } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/toaster';
import { PwaRegister } from '@/components/pwa-register';
import { InstallAppButton } from '@/components/install-app-button';
import '../globals.css';

export const viewport: Viewport = {
  themeColor: '#0057FF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Daily Entries',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
};

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const cairo = Cairo({ subsets: ['arabic'], variable: '--font-arabic', display: 'swap' });

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ar' }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var fs = localStorage.getItem('de-font-size');
            var sizes = { normal: '100%', large: '115%', xl: '130%' };
            if (fs && sizes[fs]) document.documentElement.style.fontSize = sizes[fs];
          } catch(e) {}
        `}} />
      </head>
      <body className={`${inter.variable} ${cairo.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
          <Toaster />
          <PwaRegister />
          <InstallAppButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
