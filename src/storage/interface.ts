export interface StorageInterface {
  listWithMetadata: (options?: ListFilterOptions) => Promise<ListResultWithMetadata>;
  list: (options?: ListFilterOptions) => Promise<ListResult>;
  readWithMetadata: (
    key: string
  ) => Promise<{ data: ReadableStream | undefined; metadata: Record<string, string> | undefined }>;
  read: (key: string) => Promise<ReadableStream | undefined>;
  write: (key: string, data: ReadableStream, metadata?: Record<string, string>) => Promise<void>;
}

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
  keys: { key: string; metadata: Record<string, string> | undefined }[];
  cursor?: string;
  truncated: boolean;
};
