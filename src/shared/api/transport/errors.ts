export type TransportErrorKind = "network" | "timeout";

export class TransportError extends Error {
  readonly kind: TransportErrorKind;

  constructor(kind: TransportErrorKind) {
    super(`Transport ${kind} error`);
    this.name = "TransportError";
    this.kind = kind;
  }
}

export const createAbortError = () => new DOMException("Request aborted", "AbortError");

export const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";
