import { defineHandler, redirect } from 'nitro/h3';

export default defineHandler(() =>
  redirect('https://adirishi.github.io/turborepo-remote-cache-cloudflare'),
);
