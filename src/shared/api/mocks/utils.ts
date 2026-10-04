import type { FileSearchMode } from "../search/modes";
import { createAbortError } from "../transport/errors";
import type { TransportRequest, TransportResponse } from "../transport/types";
import type { MockStorage } from "./storage";

export type MockDelays = {
  jsonMs: number;
  uploadTickMs: number;
  minUploadMs: number;
  uploadBytesPerSecond: number;
  processingMs: Record<FileSearchMode, number>;
};

export const DEFAULT_MOCK_DELAYS: MockDelays = {
  jsonMs: 300,
  uploadTickMs: 100,
  minUploadMs: 1500,
  uploadBytesPerSecond: 2 * 1024 * 1024,
  processingMs: { image: 3000, video: 5000 },
};

export const NO_MOCK_DELAYS: MockDelays = {
  jsonMs: 0,
  uploadTickMs: 0,
  minUploadMs: 0,
  uploadBytesPerSecond: Number.POSITIVE_INFINITY,
  processingMs: { image: 0, video: 0 },
};

export type MockContext = {
  request: TransportRequest;
  storage: MockStorage;
  delays: MockDelays;
};

export type MockHandler = (context: MockContext) => Promise<TransportResponse>;

const serializeBody = (body: unknown): string => {
  if (body === undefined) {
    return "";
  }

  return typeof body === "string" ? body : JSON.stringify(body);
};

export const mockResponse = (
  status: number,
  body?: unknown,
  headers: Record<string, string> = {},
): TransportResponse => {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );

  return { status, bodyText: serializeBody(body), getHeader: (name) => normalizedHeaders[name.toLowerCase()] ?? null };
};

export const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const handleAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
