import { defineHandler } from 'nitro';

import { artifactResponseHeaders, readArtifact } from '../../../utils/artifacts';
import { toHttpError } from '../../../utils/http';
import { useStorage } from '../../../utils/storage';

export default defineHandler(async (event) => {
  const { key } = readArtifact(event);
  const info = await useStorage(event).head(key).catch(toHttpError);
  return new Response(null, { headers: artifactResponseHeaders(info) });
});
