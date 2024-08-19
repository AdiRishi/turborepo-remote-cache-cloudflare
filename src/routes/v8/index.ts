import { Env } from '../..';
import { artifactRouter } from './artifacts';
import { Hono } from 'hono/tiny';

export const v8App = new Hono<{ Bindings: Env }>();

v8App.route('/artifacts', artifactRouter);
