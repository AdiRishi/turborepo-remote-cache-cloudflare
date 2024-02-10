export interface StorageInterface {
  listWithMetadata: (options?: ListFilterOptions) => Promise<ListResultWithMetadata>;
  list: (options?: ListFilterOptions) => Promise<ListResult>;
  readWithMetadata: (
    key: string
  ) => Promise<{ data: ReadableStream | undefined; metadata: Metadata | undefined }>;
  read: (key: string) => Promise<ReadableStream | undefined>;
  write: (key: string, data: WritableValue, metadata?: Record<string, string>) => Promise<void>;
  delete: (key: string | string[]) => Promise<void>;
}

export type WritableValue = string | ReadableStream | ArrayBuffer;

export type ListFilterOptions = {
  limit?: number;
  cursor?: string;
  prefix?: string;
};

export type ListResult = {
  keys: string[];
  cursor?: string;
  truncated: boolean;
};

export type ListResultWithMetadata = {
  keys: { key: string; metadata: Metadata }[];
  cursor?: string;
  truncated: boolean;
};

export type Metadata = {
  createdAtEpochMillisecondsStr: string;
  [key: string]: string | undefined;
};
