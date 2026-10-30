import { createServer, request } from 'node:http';

/** Forwards every request to `target` and records each one as `METHOD /path`. */
export const startRecordingProxy = async (target: string) => {
  const requests: string[] = [];
  const server = createServer((incoming, outgoing) => {
    const url = new URL(incoming.url ?? '/', target);
    requests.push(`${incoming.method} ${url.pathname}`);
    const upstream = request(
      url.href,
      { method: incoming.method, headers: incoming.headers },
      (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(outgoing);
      },
    );
    upstream.on('error', (error) => {
      outgoing.destroy(error);
    });
    incoming.pipe(upstream);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The proxy is not listening on a TCP port');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
};
