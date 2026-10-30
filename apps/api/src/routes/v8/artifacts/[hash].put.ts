import type { components } from '@turborepo-remote-cache/spec';

import { defineHandler } from 'nitro';

import { readArtifact, toStoredMetadata, UploadHeaders } from '../../../utils/artifacts';
import { parseInput, toHttpError } from '../../../utils/http';
import { recordTransfer } from '../../../utils/stats';
import { useStorage } from '../../../utils/storage';

export default defineHandler(async (event) => {
  const { team, key } = readArtifact(event);
  const headers = parseInput(UploadHeaders, Object.fromEntries(event.req.headers));

  await useStorage(event)
    .upload(key, event.req.body ?? new Uint8Array(), { metadata: toStoredMetadata(headers) })
    .catch(toHttpError);
  recordTransfer(event, { team, direction: 'upload', bytes: Number(headers['content-length']) });

  const url = new URL(event.url);
  url.search = new URLSearchParams({ teamId: team }).toString();
  event.res.status = 202;
  return { urls: [url.href] } satisfies components['schemas']['ArtifactUploadResponse'];
});
