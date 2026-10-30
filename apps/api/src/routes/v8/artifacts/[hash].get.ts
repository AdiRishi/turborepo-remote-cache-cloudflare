import { defineHandler } from 'nitro';

import { artifactResponseHeaders, ClientHeaders, readArtifact } from '../../../utils/artifacts';
import { parseInput, toHttpError } from '../../../utils/http';
import { recordTransfer } from '../../../utils/stats';
import { useStorage } from '../../../utils/storage';

export default defineHandler(async (event) => {
  parseInput(ClientHeaders, Object.fromEntries(event.req.headers));
  const { team, key } = readArtifact(event);
  const file = await useStorage(event).download(key, { as: 'stream' }).catch(toHttpError);
  recordTransfer(event, { team, direction: 'download', bytes: file.size });
  return new Response(file.stream(), { headers: artifactResponseHeaders(file) });
});
