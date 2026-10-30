import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';

import { TooltipProvider } from '@/components/ui/tooltip';
import { THEME_SCRIPT } from '@/lib/theme';

import stylesheet from '../styles.css?url';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'color-scheme', content: 'light dark' },
      { title: 'Turborepo Remote Cache' },
    ],
    links: [
      { rel: 'stylesheet', href: stylesheet },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
    scripts: [{ children: THEME_SCRIPT }],
  }),
  shellComponent: RootDocument,
  component: Root,
});

function Root() {
  return (
    <TooltipProvider delayDuration={150}>
      <Outlet />
    </TooltipProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
