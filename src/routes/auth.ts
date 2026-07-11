import { bearerAuth } from 'hono/bearer-auth';
import { timingSafeEqual } from 'hono/utils/buffer';

import type { AppBindings } from '../runtime/app-env';

export const bearerAuthFromEnv = bearerAuth<{ Bindings: AppBindings }>({
  verifyToken: (token, c) => timingSafeEqual(c.env.TURBO_TOKEN, token),
});
