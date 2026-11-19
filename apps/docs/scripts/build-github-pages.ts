// Writes the site that GitHub Pages serves: one page for each page of the built site, which redirects to
// that page's canonical URL on turborepo-remote-cache.dev.
//
// GitHub Pages cannot answer with a redirect status. Search engines treat an immediate meta refresh as a
// permanent redirect, so the old github.io URLs pass their ranking to the pages they point at.

import { glob, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const SITE = join(import.meta.dirname, '../dist');
const OUTPUT = join(import.meta.dirname, '../dist-github-pages');

const canonicalUrl = async (page: string) => {
  const html = await readFile(join(SITE, page), 'utf8');
  const url = /<link rel="canonical" href="([^"]+)"/u.exec(html)?.[1];
  if (url === undefined) {
    throw new Error(`${page} declares no canonical URL, so its redirect has no target.`);
  }
  return url;
};

// A meta refresh drops the query string and the fragment. The script keeps both, and runs first.
const redirectPage = (url: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Redirecting to ${url}</title>
    <link rel="canonical" href="${url}" />
    <script>
      location.replace(document.querySelector('link[rel="canonical"]').href + location.search + location.hash);
    </script>
    <meta http-equiv="refresh" content="0; url=${url}" />
  </head>
  <body>
    <a href="${url}">This page moved to ${url}</a>
  </body>
</html>
`;

// GitHub Pages serves this page for every other path. A project site lives under the repository's name,
// the first path segment, and the rest of the path is the same on turborepo-remote-cache.dev.
const notFoundPage = (origin: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Redirecting to ${origin}</title>
    <script>
      location.replace(
        '${origin}/' + location.pathname.split('/').slice(2).join('/') + location.search + location.hash,
      );
    </script>
  </head>
  <body>
    <a href="${origin}">This site moved to ${origin}</a>
  </body>
</html>
`;

await rm(OUTPUT, { recursive: true, force: true });

for await (const page of glob('**/index.html', { cwd: SITE })) {
  const file = join(OUTPUT, page);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, redirectPage(await canonicalUrl(page)));
}

await writeFile(
  join(OUTPUT, '404.html'),
  notFoundPage(new URL(await canonicalUrl('index.html')).origin),
);
