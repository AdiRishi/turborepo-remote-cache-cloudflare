import { join } from 'node:path';

/** The built dashboard: an `index.html` shell and its hashed assets. */
export const clientDir = join(import.meta.dirname, 'dist/client');
