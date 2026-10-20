/**
 * Regenerates every file in assets/ from the mark and wordmark geometry.
 * Run with `pnpm --filter @turborepo-remote-cache/brand generate`.
 */

import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

import type { Word } from './wordmark.ts';

import { setWords } from './wordmark.ts';

const AMBER = '#ffb224';
const AMBER_ON_LIGHT = '#f2a30f';
const INK = '#0e1013';
const PAPER = '#ecedef';
const TILE = '#111317';

const assets = new URL('../assets/', import.meta.url);
const write = (name: string, svg: string) => writeFile(new URL(name, assets), `${svg}\n`);
const svg = (viewBox: string, body: string, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${attrs ? ` ${attrs}` : ''}>${body}</svg>`;

/** The 24 unit mark: slabs 18 x 7, gaps 1.5, the middle slab pulled 6 to the right. */
const mark24 = (drawer: string) =>
  '<rect width="18" height="7" rx="1.75"/>' +
  '<rect y="17" width="18" height="7" rx="1.75"/>' +
  `<rect x="6" y="8.5" width="18" height="7" rx="1.75" fill="${drawer}"/>`;

/** The 16 px pixel-grid mark: 4 px slabs, 2 px gaps, the middle slab pulled 5 px. */
const mark16 = (slab: string, drawer: string) =>
  `<rect width="11" height="4" rx="1" fill="${slab}"/>` +
  `<rect y="12" width="11" height="4" rx="1" fill="${slab}"/>` +
  `<rect x="5" y="6" width="11" height="4" rx="1" fill="${drawer}"/>`;

/** A full-bleed graphite tile with the mark centred; `inset` is the margin on each side. */
const tile = (size: number, inset: number) => {
  const scale = (size - inset * 2) / 24;
  return svg(
    `0 0 ${size} ${size}`,
    `<rect width="${size}" height="${size}" fill="${TILE}"/>` +
      `<g transform="translate(${inset} ${inset}) scale(${scale})" fill="${PAPER}">${mark24(AMBER)}</g>`,
    `width="${size}" height="${size}"`,
  );
};

/** "turborepo" is the lighter qualifier; "remote cache" carries the weight. */
const LIGHT = 1.3;
const BOLD = 2;
const QUALIFIER: Word = { text: 'turborepo', stroke: LIGHT };
const PRODUCT: Word[] = [
  { text: 'remote', stroke: BOLD },
  { text: 'cache', stroke: BOLD },
];
const NAME = [QUALIFIER, ...PRODUCT];

const strokes = (words: { d: string; stroke: number }[], color: string) =>
  words
    .map((w) => `<path d="${w.d}" fill="none" stroke="${color}" stroke-width="${w.stroke}"/>`)
    .join('');

/** Single-line lockup: the mark spans ascender to baseline, 7 units before the text. */
const lockup = (slab: string, drawer: string, text: string) => {
  const set = setWords(NAME, 16 + 7);
  return svg(
    `0 0 ${set.width} 20`,
    `<g fill="${slab}" transform="scale(${(16 / 24).toFixed(4)})">${mark24(drawer)}</g>${strokes(set.words, text)}`,
    `width="${set.width * 2}" height="40" role="img" aria-label="Turborepo Remote Cache"`,
  );
};

/** Two-tier lockup for narrow spaces: "turborepo" over "remote cache", the mark spanning both. */
const lockupStacked = (slab: string, drawer: string, text: string) => {
  const markSize = 32;
  const x = markSize + 9;
  const top = setWords([QUALIFIER], x);
  const bottom = setWords(PRODUCT, x);
  const width = Math.max(top.width, bottom.width);
  return svg(
    `0 0 ${width} 37`,
    `<g fill="${slab}" transform="translate(0 1) scale(${markSize / 24})">${mark24(drawer)}</g>` +
      strokes(top.words, text) +
      `<g transform="translate(0 17)">${strokes(bottom.words, text)}</g>`,
    `width="${width * 2}" height="74" role="img" aria-label="Turborepo Remote Cache"`,
  );
};

const wordmark = () => {
  const set = setWords(NAME);
  return svg(
    `0 1 ${set.width} 19`,
    strokes(set.words, 'currentColor'),
    `width="${set.width * 2}" height="38" role="img" aria-label="Turborepo Remote Cache"`,
  );
};

const appIcon = tile(512, 112);
const appleTouchIcon = tile(180, 40);
const markAttrs = 'width="24" height="24" role="img" aria-label="Turborepo Remote Cache"';
const files: Record<string, string> = {
  'mark.svg': svg('0 0 24 24', `<g fill="currentColor">${mark24('currentColor')}</g>`, markAttrs),
  'mark-duotone.svg': svg('0 0 24 24', `<g fill="currentColor">${mark24(AMBER)}</g>`, markAttrs),
  'mark-16.svg': svg(
    '0 0 16 16',
    mark16('currentColor', AMBER),
    'width="16" height="16" role="img" aria-label="Turborepo Remote Cache"',
  ),
  'favicon.svg': svg(
    '0 0 16 16',
    `<style>.s{fill:${INK}}.d{fill:${AMBER_ON_LIGHT}}@media (prefers-color-scheme:dark){.s{fill:${PAPER}}.d{fill:${AMBER}}}</style>` +
      '<rect class="s" width="11" height="4" rx="1"/><rect class="s" y="12" width="11" height="4" rx="1"/>' +
      '<rect class="d" x="5" y="6" width="11" height="4" rx="1"/>',
  ),
  'app-icon.svg': appIcon,
  'apple-touch-icon.svg': appleTouchIcon,
  'wordmark.svg': wordmark(),
  'lockup.svg': lockup('currentColor', AMBER, 'currentColor'),
  'lockup-on-dark.svg': lockup(PAPER, AMBER, PAPER),
  'lockup-on-light.svg': lockup(INK, AMBER_ON_LIGHT, INK),
  'lockup-stacked.svg': lockupStacked('currentColor', AMBER, 'currentColor'),
};

await Promise.all(Object.entries(files).map(([name, body]) => write(name, body)));

const png = (source: string, size: number, name: string) =>
  sharp(Buffer.from(source))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(new URL(name, assets).pathname);

await Promise.all([
  png(appleTouchIcon, 180, 'apple-touch-icon.png'),
  png(appIcon, 192, 'icon-192.png'),
  png(appIcon, 512, 'icon-512.png'),
]);
