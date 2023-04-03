import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from '..';

export const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

app.get('/ping', (c) => c.text('pong'));
