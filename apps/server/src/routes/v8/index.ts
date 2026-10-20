import { Hono } from 'hono/tiny';

import type { Env } from '../..';

import { artifactRouter } from './artifacts';

export const v8App = new Hono<{ Bindings: Env }>();

v8App.route('/artifacts', artifactRouter);
