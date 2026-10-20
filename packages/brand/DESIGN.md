# Turborepo Remote Cache design reference

The brand package is the single source for the marks, lockups, icons, and theme tokens. The dashboard (React, Tailwind CSS v4, shadcn/ui) and the docs (Blume) both consume it.

## Using the package

| Export                                          | Contents                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `@turborepo-remote-cache/brand/tokens.css`      | shadcn theme for Tailwind CSS v4: `:root`, `.dark`, `@theme inline`, and the `num` utility |
| `@turborepo-remote-cache/brand/blume-theme.css` | `--blume-*` overrides for the docs `theme.css`                                             |
| `@turborepo-remote-cache/brand/assets/*`        | Any file in `assets/`                                                                      |

```css
/* dashboard globals.css */
@import 'tailwindcss';
@import '@turborepo-remote-cache/brand/tokens.css';
```

```ts
import lockup from '@turborepo-remote-cache/brand/assets/lockup.svg';
```

Inline the SVG (for example with Vite's `?raw` or an SVG component plugin) when it should follow the text color. An `<img>` renders `currentColor` as black.

Regenerate `assets/` after changing the geometry:

```bash
pnpm --filter @turborepo-remote-cache/brand generate
```

## Brand

The mark is three storage slots with the middle one pulled out to the right: an artifact leaving the cache to be replayed somewhere else. Only the pulled slot is amber. Across the product, amber means work nobody had to redo.

| Property      | 24 unit mark | 16 px favicon grid |
| ------------- | ------------ | ------------------ |
| Slab size     | 18 x 7       | 11 x 4             |
| Gap           | 1.5          | 2                  |
| Drawer offset | 6            | 5                  |
| Corner radius | 1.75         | 1                  |

The wordmark is a hand-drawn lowercase monoline: x-height 10 units, ascenders to 1, descenders to 20. "turborepo" uses a 1.3 unit stroke and "remote cache" a 2 unit stroke, so the product noun carries the weight and "turborepo" names the ecosystem. The lettering shares nothing with Turborepo's own logo or type, and the mark is ours.

- The single-line `lockup.svg` is 241 x 20 units. In a 56 px bar, render it 22 px tall. Under 760 px wide, show the mark alone.
- `lockup-stacked.svg` puts "turborepo" over "remote cache" for square or narrow slots, such as the sign-in card or a README header.
- Clear space is one slab height. The minimum lockup height is 16 px.
- Never fill the whole mark amber, rotate or mirror it, or use amber for warnings.

### Assets

| File                                           | Use                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `mark.svg`                                     | Single color, `currentColor`                                            |
| `mark-duotone.svg`                             | `currentColor` slabs, amber drawer. Default product mark.               |
| `mark-16.svg`                                  | Pixel-grid mark for 16 px UI slots                                      |
| `favicon.svg`                                  | Switches slab color with `prefers-color-scheme`                         |
| `apple-touch-icon.svg`, `apple-touch-icon.png` | 180 px graphite tile. iOS rounds the corners.                           |
| `app-icon.svg`, `icon-192.png`, `icon-512.png` | PWA manifest and avatars. The mark stays inside the maskable safe zone. |
| `wordmark.svg`                                 | Wordmark alone, `currentColor`                                          |
| `lockup.svg`                                   | Mark and wordmark, `currentColor` and amber                             |
| `lockup-on-dark.svg`, `lockup-on-light.svg`    | Fixed colors for places CSS can't reach, such as a README `<picture>`   |
| `lockup-stacked.svg`                           | Two-tier lockup, `currentColor` and amber                               |

## Color tokens

`tokens.css` uses shadcn's variable names, so shadcn components pick it up unchanged. Dark values apply under `.dark`, which matches `next-themes` with `attribute="class"`.

| Token                                | Light     | Dark                            | Use                                                  |
| ------------------------------------ | --------- | ------------------------------- | ---------------------------------------------------- |
| `--background`                       | `#f5f6f8` | `#0b0c0e`                       | Page                                                 |
| `--foreground`                       | `#0e1013` | `#ecedef`                       | Primary text                                         |
| `--card`                             | `#ffffff` | `#111317`                       | Cards, chart surface                                 |
| `--popover`                          | `#ffffff` | `#16181c`                       | Tooltips, menus, select content                      |
| `--primary`                          | `#ffb224` | `#ffb224`                       | Primary button, active tab underline                 |
| `--primary-foreground`               | `#1a1405` | `#1a1405`                       | Label on amber (10.3:1)                              |
| `--secondary`, `--accent`, `--muted` | `#edeff2` | `#1c1f24`, `#1c1f24`, `#181a1f` | Secondary button, hover wash, tracks and inline code |
| `--muted-foreground`                 | `#5c6370` | `#8c929c`                       | Secondary text (6.0:1, 5.9:1 on card)                |
| `--destructive`                      | `#d93a2f` | `#f0574c`                       | Errors                                               |
| `--border`                           | `#e2e5e9` | `#23262c`                       | Hairlines, card borders                              |
| `--input`                            | `#d6dae0` | `#2d3138`                       | Input borders                                        |
| `--ring`                             | `#b57500` | `#ffb224`                       | Focus ring (`#b57500` keeps 3:1 on white)            |
| `--brand`                            | `#ffb224` | `#ffb224`                       | Mark drawer, brand fills                             |
| `--brand-text`                       | `#8f5b00` | `#ffc452`                       | Amber as text (5.7:1, 11.8:1)                        |
| `--success`                          | `#12804a` | `#45c486`                       | Positive deltas, online status                       |
| `--code`                             | `#f7f8fa` | `#0e1013`                       | Code block surface                                   |
| `--chart-1`                          | `#cc8400` | `#cb8315`                       | Remote hit, time saved, single-series bars           |
| `--chart-2`                          | `#6a6ee0` | `#8a82e9`                       | Local hit                                            |
| `--chart-3`                          | `#a9aeb7` | `#4a4f59`                       | Miss, de-emphasized bars                             |
| `--chart-4`                          | `#f5e6c8` | `#3a2d14`                       | Meter track                                          |
| `--chart-5`                          | `#c9cdd3` | `#33373e`                       | Chart baseline                                       |
| `--chart-grid`                       | `#eceef1` | `#1d2025`                       | Gridlines                                            |
| `--radius`                           | `0.5rem`  |                                 | Base radius                                          |

There is no warning token. A warning uses a neutral `Alert` with an icon and a label.

## Type

| Role                     | Family       | Weight | Size / line                                  | Tracking |
| ------------------------ | ------------ | ------ | -------------------------------------------- | -------- |
| Hero figure              | Martian Mono | 500    | 52 to 88 / 0.92, units at 0.42em             | -0.045em |
| Docs display             | Host Grotesk | 600    | 40 to 64 / 1.02                              | -0.05em  |
| Page title               | Host Grotesk | 600    | 24 / 32                                      | -0.02em  |
| Card title               | Host Grotesk | 600    | 15 / 20                                      | -0.005em |
| Body, app                | Host Grotesk | 400    | 14 / 20                                      | 0        |
| Body, docs               | Host Grotesk | 400    | 16 / 26                                      | 0        |
| Small                    | Host Grotesk | 400    | 12 / 16, 13 / 18                             | 0        |
| KPI value                | Martian Mono | 500    | 28 / 36 (22 / 30 on mobile), units at 0.55em | -0.035em |
| Code, hashes, IDs, ticks | Martian Mono | 400    | 12.5 / 20, ticks 10.5                        | -0.01em  |

Load `Host+Grotesk:wght@400..700` and `Martian+Mono:wdth,wght@75..112.5,400..700`. Martian Mono always runs at `font-stretch: 87.5%`; the `num` utility and the base layer in `tokens.css` set it. Use the mono only for data, hashes, team slugs, header values, and code. Numbers inside sentences stay in Host Grotesk. Labels are sentence case.

Spacing uses a 4 px base: cards pad 20 px (16 px under 760 px), and grids gap 16 px. Radius: buttons and inputs `md` (6 px), toggle groups and code blocks `lg` (8 px), cards `xl` (12 px), badges fully rounded. Content is at most 1200 px wide. Breakpoints are 1020 px (single column) and 760 px (mobile header, 2 by 2 KPIs). Layouts must work at 375 px.

## Charts

Build charts with shadcn's `Chart` components on Recharts, with colors passed through `ChartConfig` as `var(--chart-n)`.

| Data                          | Form                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- |
| Time saved, total             | Hero figure, one per view                                              |
| Time saved per day            | Single-series area: 2 px line, 10% wash, no legend                     |
| Cache results per day         | Stacked columns: remote hit at the baseline, then local hit, then miss |
| Time saved by team, by client | Horizontal bars in one hue, value at the tip                           |
| Signed artifacts              | `Progress` meter on the `chart-4` track                                |
| Results within a run          | 96 px mini stacked bar with a text summary                             |

- Never use dual axes. Hits and time saved get separate charts.
- Remote hit and local hit pass the palette validator in both modes: CVD dE 29.6 light and 27.7 dark, at least 3:1 against the card. Miss is a de-emphasis gray at 2.2:1, so the legend, tooltip, and table view must always be present.
- Hue follows the entity, never its rank. With a team filter, the team chart keeps every team and grays the others.
- Columns are at most 24 px wide (about 62% of the band), with a 4 px rounded top and a 2 px gap between stacked segments. Never draw strokes around marks.
- Gridlines are 1 px solid `chart-grid` and the baseline is `chart-5`. Use 3 to 4 ticks on clean steps (0, 500, 1K or 0h, 10h, 20h).
- Ticks are Martian Mono 10.5 px in muted text. The last tick reads "Today" and covers partial data.
- Text never takes a series color. Keys sit beside the text.
- The area chart has a crosshair that snaps to the nearest day, and arrow keys move it. Each column band is the hit target and is focusable; hovering one column dims the others to 45%.
- Tooltips list the value first and the series name second, with a 10 x 2 line key, and show every series at that x.
- Every chart has a Table toggle with an equivalent table. Bar lists label every value, so they don't need one.
- The filter row (date range, team) sits above everything it scopes. Totals that ignore the range say so.
- On refetch, keep the previous render at reduced opacity. Use no skeletons after the first load.

## Metric definitions

| UI label                              | Definition                                                                                      | Source                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Time saved by remote cache hits       | Sum of stored task duration for remote hits                                                     | `x-artifact-duration` on the stored artifact, matched to REMOTE HIT events |
| Remote hit rate                       | REMOTE HIT / (REMOTE HIT + REMOTE MISS)                                                         | `/v8/artifacts/events`. LOCAL events are excluded.                         |
| Cache results per day                 | LOCAL HIT, REMOTE HIT, and misses per UTC day                                                   | events (`source`, `event`)                                                 |
| Turbo runs                            | Distinct `sessionId`                                                                            | events                                                                     |
| Tasks per run                         | Lookups / runs                                                                                  | events                                                                     |
| Downloaded                            | Bytes and count of artifact GETs                                                                | request log                                                                |
| Uploaded                              | Bytes and count of artifact PUTs                                                                | request log                                                                |
| Artifacts stored, total size, largest | Current object count, bytes, and max size                                                       | storage provider                                                           |
| Signed artifacts                      | Share of stored artifacts with `x-artifact-tag`                                                 | artifact metadata                                                          |
| Retention, cleanup                    | `BUCKET_OBJECT_EXPIRATION_HOURS` (default 720 h) and the cron schedule                          | config                                                                     |
| By team                               | Grouped by `teamId` or `slug`                                                                   | query string                                                               |
| By client                             | Grouped by `x-artifact-client-ci`. Interactive runs outside CI show as "Developer machines".    | headers                                                                    |
| Recent runs                           | Events grouped by `sessionId`, with the hash, result, duration, size, and signed state per task | events, metadata                                                           |
| Online                                | Health check result                                                                             | server                                                                     |

Usage stats need Cloudflare Workers with a D1 database bound as `STATS_DB`. Without it, the overview shows server status, storage provider, and retention, plus a card with the setup steps. The dashboard never displays the token. Connect snippets use a `<your TURBO_TOKEN>` placeholder. Show CI providers and platforms as text, never as vendor logos.

## Components

| UI                        | shadcn/ui                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| Header nav                | Links styled as `Tabs`, 2 px amber underline on the active item                                 |
| Status pill               | `Badge` (outline) with a dot and a label                                                        |
| Theme switch              | `DropdownMenu` with Light, Dark, and System                                                     |
| Sign-in                   | `Card`, `Label`, `Input` (password) with a ghost icon `Button` to show and hide, `Button`       |
| Sign-in error             | `FormMessage` or `Alert` (destructive), with `aria-invalid` on the input                        |
| Date range                | `ToggleGroup` (single): 7 days, 30 days                                                         |
| Team filter               | `Select`                                                                                        |
| Hero figure, delta        | Custom                                                                                          |
| KPI strip                 | Custom grid with `Separator`s, deliberately not four `Card`s                                    |
| Charts                    | `Chart` (`ChartContainer`, `ChartTooltip`, `ChartLegend`) on `AreaChart` and stacked `BarChart` |
| Table view                | `Toggle` and `Table`                                                                            |
| Bar lists                 | Custom divs                                                                                     |
| Signed meter              | `Progress`                                                                                      |
| Storage facts, info cards | `Card` with a `<dl>`                                                                            |
| Recent runs               | `Table` and `Collapsible`, stacked rows on mobile                                               |
| Steps                     | Custom ordered list, numbers in Martian Mono                                                    |
| Code block                | Custom, with a copy `Button` (ghost, icon) and `sonner` for "Copied"                            |
| Config and CI snippets    | `Tabs`                                                                                          |
| Notes                     | `Alert` (default) with an info icon                                                             |
| Server URL                | `Input` (read-only) and a copy `Button`                                                         |

Icons come from `lucide-react` with `absoluteStrokeWidth` and `strokeWidth={1.5}`: 16 px in dense UI and 20 px in navigation and empty states. Icons take the text color.

## Docs on Blume

Use `blume-theme.css` for the token overrides, plus the `blume.config.ts` block in its header comment. Accent text is `#8f5b00` on light pages and `#ffb224` on dark ones, which clears 4.5:1. The `action` color is always bright amber with dark ink. Set `logo` to `lockup.svg`; Blume inlines it so it follows the text color. Blume's full-width layout ignores layout-slot overrides, so do not override the `Logo` slot. The docs footer says the project is independent and not affiliated with Vercel or Cloudflare.
