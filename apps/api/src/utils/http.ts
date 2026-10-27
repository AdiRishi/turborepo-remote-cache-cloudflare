import type { H3Event } from 'nitro';

import { FilesError } from 'files-sdk';
import { HTTPError } from 'nitro';
import * as v from 'valibot';

export const parseInput = <TSchema extends v.GenericSchema>(
  schema: TSchema,
  input: unknown,
): v.InferOutput<TSchema> => {
  const result = v.safeParse(schema, input);
  if (!result.success) {
    throw new HTTPError({ status: 400, message: v.summarize(result.issues) });
  }
  return result.output;
};

export const readJsonBody = async <TSchema extends v.GenericSchema>(
  event: H3Event,
  schema: TSchema,
): Promise<v.InferOutput<TSchema>> => {
  const body: unknown = await event.req.json().catch(() => {
    throw new HTTPError({ status: 400, message: 'The request body is not valid JSON' });
  });
  return parseInput(schema, body);
};

export const toHttpError = (error: unknown): never => {
  if (error instanceof FilesError && error.code === 'NotFound') {
    throw new HTTPError({ status: 404, message: 'Artifact not found' });
  }
  if (error instanceof FilesError && error.code === 'Invalid') {
    throw new HTTPError({ status: 400, message: error.message });
  }
  throw error;
};
