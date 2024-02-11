import { Hono } from 'hono';
import { Env } from '../..';
import { artifactRouter } from './artifacts';

export const v8App = new Hono<{ Bindings: Env }>();

v8App.route('/artifacts', artifactRouter);
