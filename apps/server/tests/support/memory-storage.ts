import { Files } from 'files-sdk';
import { memory } from 'files-sdk/memory';

import type { CustomAdapter } from '../../src/utils/storage';

export const adapter = memory();

export const storage = new Files({ adapter });

export const customAdapter: CustomAdapter = () => adapter;
