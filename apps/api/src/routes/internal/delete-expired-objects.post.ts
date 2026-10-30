import { defineHandler } from 'nitro';
import * as v from 'valibot';

import { eventEnv } from '../../utils/env';
import { expireArtifacts } from '../../utils/expiry';
import { readJsonBody } from '../../utils/http';

const DeleteExpiredRequest = v.object({
  expireInHours: v.optional(v.pipe(v.number(), v.minValue(0))),
});

export default defineHandler(async (event) => {
  const { expireInHours } = await readJsonBody(event, DeleteExpiredRequest);
  const deleted = await expireArtifacts(eventEnv(event), expireInHours);
  return { deleted };
});
