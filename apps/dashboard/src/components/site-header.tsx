import { BookOpen, Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RANGE_LABELS } from '@/lib/stats';
import { useTheme } from '@/lib/theme';

import type { StatsRange } from '../../contract';

import { STATS_RANGES } from '../../contract';
import { BrandMark, Lockup } from './brand';

const DOCS_URL = 'https://turborepo-remote-cache.dev';

const isRange = (value: string): value is StatsRange =>
  STATS_RANGES.some((range) => range === value);

export function SiteHeader({
  range,
  onRangeChange,
}: {
  range: StatsRange;
  onRangeChange: (range: StatsRange) => void;
}) {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-8">
        <a href="/" className="flex items-center gap-3 text-foreground">
          <Lockup className="hidden h-[18px] w-auto sm:block" />
          <BrandMark className="size-5 sm:hidden" />
        </a>
        <ToggleGroup
          type="single"
          size="sm"
          value={range}
          onValueChange={(value) => {
            if (isRange(value)) {
              onRangeChange(value);
            }
          }}
          aria-label="Time range"
          className="ml-auto"
        >
          {STATS_RANGES.map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              aria-label={RANGE_LABELS[option]}
              className="px-2.5 text-muted-foreground data-[state=on]:text-foreground"
            >
              {option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-1">
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
