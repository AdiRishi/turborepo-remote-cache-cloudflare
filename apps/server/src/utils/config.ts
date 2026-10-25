import type { S3FetchAdapterOptions } from 'files-sdk/s3-fetch';

import * as v from 'valibot';

import type { PlatformEnv } from './env';

const nonEmptyString = v.pipe(v.string(), v.nonEmpty());

const positiveInteger = v.pipe(
  v.union([v.number(), v.pipe(v.string(), v.digits(), v.transform(Number))]),
  v.integer(),
  v.minValue(1),
);

const booleanFlag = v.union([
  v.boolean(),
  v.pipe(
    v.picklist(['true', 'false']),
    v.transform((flag) => flag === 'true'),
  ),
]);

const TokenConfig = v.object({ TURBO_TOKEN: nonEmptyString });

const ExpirationConfig = v.object({
  BUCKET_OBJECT_EXPIRATION_HOURS: v.optional(positiveInteger, 720),
});

const S3Config = v.pipe(
  v.object({
    S3_BUCKET: nonEmptyString,
    S3_ENDPOINT: v.pipe(v.string(), v.url()),
    S3_REGION: v.optional(nonEmptyString),
    S3_ACCESS_KEY_ID: v.optional(nonEmptyString),
    S3_SECRET_ACCESS_KEY: v.optional(nonEmptyString),
    S3_SESSION_TOKEN: v.optional(nonEmptyString),
    S3_FORCE_PATH_STYLE: v.optional(booleanFlag),
  }),
  v.transform((config): S3FetchAdapterOptions => ({
    bucket: config.S3_BUCKET,
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    sessionToken: config.S3_SESSION_TOKEN,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
  })),
);

export const configError = (message: string) =>
  new Error(`Invalid server configuration: ${message}`);

const parseConfig = <TSchema extends v.GenericSchema>(
  schema: TSchema,
  env: PlatformEnv,
): v.InferOutput<TSchema> => {
  const result = v.safeParse(schema, env);
  if (!result.success) {
    throw configError(v.summarize(result.issues));
  }
  return result.output;
};

export const readToken = (env: PlatformEnv) => parseConfig(TokenConfig, env).TURBO_TOKEN;

export const readExpirationHours = (env: PlatformEnv) =>
  parseConfig(ExpirationConfig, env).BUCKET_OBJECT_EXPIRATION_HOURS;

export const readS3Options = (env: PlatformEnv) =>
  env.S3_BUCKET === undefined ? undefined : parseConfig(S3Config, env);
