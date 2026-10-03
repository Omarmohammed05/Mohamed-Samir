import type { ReactNode } from 'react';

// Root pass-through — html/body live in app/[locale]/layout.tsx (next-intl pattern)
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
