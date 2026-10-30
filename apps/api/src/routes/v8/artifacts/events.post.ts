import type { components } from '@turborepo-remote-cache/spec';

import { defineHandler } from 'nitro';
import * as v from 'valibot';

import { ClientHeaders, readTeam } from '../../../utils/artifacts';
import { parseInput, readJsonBody } from '../../../utils/http';
import { recordCacheEvents } from '../../../utils/stats';

type CacheEvent = components['schemas']['CacheEvent'];

const CacheEvents = v.array(
  v.object({
    // The spec requires `sessionId`, but the `turbo` client models it as optional.
    sessionId: v.optional(v.pipe(v.string(), v.uuid())),
    source: v.picklist(['LOCAL', 'REMOTE']),
    event: v.picklist(['HIT', 'MISS']),
    hash: v.string(),
    duration: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  }),
) satisfies v.GenericSchema<unknown, (Omit<CacheEvent, 'sessionId'> & Partial<CacheEvent>)[]>;

export default defineHandler(async (event) => {
  const headers = parseInput(ClientHeaders, Object.fromEntries(event.req.headers));
  const events = await readJsonBody(event, CacheEvents);
  recordCacheEvents(event, { team: readTeam(event), ci: headers['x-artifact-client-ci'], events });
  return new Response(null);
});
