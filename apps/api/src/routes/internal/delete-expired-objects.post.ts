import { defineHandler } from 'nitro';
import * as v from 'valibot';

import { readExpirationHours } from '../../utils/config';
import { eventEnv } from '../../utils/env';
import { deleteExpiredArtifacts } from '../../utils/expiry';
import { readJsonBody } from '../../utils/http';
import { openStorage } from '../../utils/storage';

const DeleteExpiredRequest = v.object({
  expireInHours: v.optional(v.pipe(v.number(), v.minValue(0))),
});

export default defineHandler(async (event) => {
  const { expireInHours } = await readJsonBody(event, DeleteExpiredRequest);
  const env = eventEnv(event);
  const deleted = await deleteExpiredArtifacts(
    openStorage(env),
    expireInHours ?? readExpirationHours(env),
  );
  return { deleted };
});
