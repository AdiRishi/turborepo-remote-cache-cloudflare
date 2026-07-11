import { defineStorageConfig } from './src/storage/custom';

// Built-in providers (r2, kv, and s3) require no source changes. Replace this
// factory when STORAGE_PROVIDER=custom should construct another Files SDK adapter.
export default defineStorageConfig(() => undefined);
