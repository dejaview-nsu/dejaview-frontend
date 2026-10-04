import { vi } from "vitest";

import type { TransportRequest, TransportResponse } from "@/shared/api";
import { createAbortError } from "@/shared/api/transport/errors";

type PendingCall = {
  request: TransportRequest;
  resolve: (response: TransportResponse) => void;
  reject: (error: unknown) => void;
};

export const jsonResponse = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): TransportResponse => {
  const normalizedHeaders = new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));

  return {
    status,
    bodyText: typeof body === "string" ? body : JSON.stringify(body),
    getHeader: (name) => normalizedHeaders.get(name.toLowerCase()) ?? null,
  };
};

export const createControlledTransport = ({ ignoreAbort = false } = {}) => {
  const calls: PendingCall[] = [];

  const transport = vi.fn(
    (request: TransportRequest) =>
      new Promise<TransportResponse>((resolve, reject) => {
        if (!ignoreAbort) {
          request.signal?.addEventListener("abort", () => reject(createAbortError()));
        }

        calls.push({ request, resolve, reject });
      }),
  );

  const current = () => {
    const call = calls.at(-1);

    if (!call) {
      throw new Error("Transport was not called");
    }

    return call;
  };

  const waitForCalls = (count: number) => vi.waitFor(() => expect(calls).toHaveLength(count));

  return { transport, calls, current, waitForCalls };
};
