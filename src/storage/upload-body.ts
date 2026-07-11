import type { Body } from 'files-sdk';

const NATIVE_R2_ADAPTER_NAME = 'r2-binding';

export class UploadBodyLengthError extends Error {
  constructor() {
    super('Content-Length does not match the request body');
    this.name = 'UploadBodyLengthError';
  }
}

interface PreparedUploadBody {
  body: Body;
  completion?: Promise<void>;
}

export const prepareUploadBody = async (
  body: ReadableStream<Uint8Array>,
  contentLength: number,
  adapterName: string,
): Promise<PreparedUploadBody> => {
  if (adapterName !== NATIVE_R2_ADAPTER_NAME) return { body };

  if (typeof FixedLengthStream !== 'undefined') {
    // Nitro preserves the header, but the request body is no longer tagged as
    // fixed-length. Restore that tag for the native R2 binding without buffering.
    const fixedLengthBody = new FixedLengthStream(contentLength);
    return {
      body: fixedLengthBody.readable,
      completion: body.pipeTo(fixedLengthBody.writable),
    };
  }

  // The Cloudflare development emulator exposes the R2 binding to Node, where
  // FixedLengthStream is unavailable. Production Workers use the stream above.
  const bufferedBody = await new Response(body).arrayBuffer();
  if (bufferedBody.byteLength !== contentLength) throw new UploadBodyLengthError();
  return { body: bufferedBody };
};
