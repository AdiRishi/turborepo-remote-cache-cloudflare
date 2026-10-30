import { fileURLToPath } from 'node:url';

/** The built dashboard: an `index.html` shell and its hashed assets. */
export const clientDir = fileURLToPath(new URL('dist/client', import.meta.url));
