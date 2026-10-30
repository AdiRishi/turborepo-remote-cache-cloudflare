import { BookOpen, Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatAge } from '@/lib/format';
import { useTheme } from '@/lib/theme';

import { BrandMark, Lockup } from './brand';

const DOCS_URL = 'https://turborepo-remote-cache.dev';

/** A dot that pings once each time fresh stats arrive. */
function LiveDot({ updatedAt }: { updatedAt: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="relative flex size-7 items-center justify-center" tabIndex={0}>
          <span
            key={updatedAt}
            className="absolute size-2 rounded-full bg-remote motion-safe:animate-ping-once"
            aria-hidden
          />
          <span className="size-2 rounded-full bg-remote" aria-hidden />
          <span className="sr-only">Updated {formatAge(updatedAt)}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>Updated {formatAge(updatedAt)}</TooltipContent>
    </Tooltip>
  );
}

export function SiteHeader({ updatedAt }: { updatedAt?: number }) {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-20 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-8">
        <a href="/" className="flex items-center gap-3 text-foreground">
          <Lockup className="hidden h-[18px] w-auto sm:block" />
          <BrandMark className="size-5 sm:hidden" />
        </a>
        <div className="ml-auto flex items-center gap-1">
          {updatedAt === undefined ? null : <LiveDot updatedAt={updatedAt} />}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={toggle}>
                {theme === 'dark' ? <Sun /> : <Moon />}
                <span className="sr-only">
                  {theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" asChild>
                <a href={DOCS_URL}>
                  <BookOpen />
                  <span className="sr-only">Documentation</span>
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Documentation</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
