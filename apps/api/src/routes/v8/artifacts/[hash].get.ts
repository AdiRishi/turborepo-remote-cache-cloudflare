import { defineHandler } from 'nitro';

import { artifactResponseHeaders, ClientHeaders, readArtifact } from '../../../utils/artifacts';
import { parseInput, toHttpError } from '../../../utils/http';
import { useStorage } from '../../../utils/storage';

export default defineHandler(async (event) => {
  parseInput(ClientHeaders, Object.fromEntries(event.req.headers));
  const { key } = readArtifact(event);
  const file = await useStorage(event).download(key, { as: 'stream' }).catch(toHttpError);
  return new Response(file.stream(), { headers: artifactResponseHeaders(file) });
});
