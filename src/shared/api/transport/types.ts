export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type TransportTimeouts = {
  upload?: number;
  response: number;
};

export type TransportRequest = {
  method: HttpMethod;
  path: string;
  body?: unknown;
  timeouts: TransportTimeouts;
  signal?: AbortSignal;
  onUploadProgress?: (fraction: number | null) => void;
  onUploadComplete?: () => void;
};

export type TransportResponse = {
  status: number;
  bodyText: string;
  getHeader: (name: string) => string | null;
};

export type Transport = (request: TransportRequest) => Promise<TransportResponse>;
