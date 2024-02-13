import { Env } from '..';
import { internalRouter } from './internal';
import { v8App } from './v8';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

export const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  return c.json({ error: err.message }, 500);
});

app.use('*', cors());

// minimal health check routes
app.get('/ping', (c) => c.text('pong'));
app.get('/throw-exception', () => {
  throw new Error('Expected error');
});

app.route('/v8', v8App);
app.route('/internal', internalRouter);

app.get('/', (c) => {
  return c.html(
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Turborepo Remote Cache</title><style>body,html{margin:0;padding:0;height:100%;display:flex;justify-content:center;align-items:center;font-family:Arial,sans-serif;background-color:#f0f0f0}.container{text-align:center;padding:20px}.title{color:#333;margin-bottom:20px}.cta-button{display:inline-block;padding:10px 20px;background-color:#007bff;color:#fff;text-decoration:none;border-radius:5px;transition:background-color .3s ease}.cta-button:hover{background-color:#0056b3}</style></head><body><div class="container"><h1 class="title">Turborepo Remote Cache</h1><a href="https://adirishi.github.io/turborepo-remote-cache-cloudflare" class="cta-button">View Documentation</a></div></body></html>'
  );
});
