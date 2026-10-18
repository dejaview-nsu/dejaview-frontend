import { type ApiError, isSearchUnavailableError } from "@/shared/api";

import { videoCheckMessages, type VideoCheckReason, videoSearchTexts } from "../config";

export type VideoSearchError = { kind: "missing" | "file" | "server" | "unavailable"; message: string };

const UNAVAILABLE_STATUSES = [502, 503, 504];

const FILE_ERROR_REASONS: Record<string, VideoCheckReason> = {
  FILE_REQUIRED: "missing",
  TOO_MANY_FILES: "multiple",
  FILE_TOO_LARGE: "tooLarge",
  UNSUPPORTED_FORMAT: "format",
  VIDEO_TOO_LONG: "tooLong",
  FILE_CORRUPTED: "corrupted",
};

const plural = new Intl.PluralRules("ru");

const seconds = { one: "секунду", few: "секунды", many: "секунд" };

const waitTime = (retryAfter: number | null) => {
  if (retryAfter === null || retryAfter <= 0) return "минуту";

  const form = plural.select(retryAfter);

  return `${retryAfter} ${form === "one" || form === "few" ? seconds[form] : seconds.many}`;
};

export const toVideoCheckReason = (error: ApiError): VideoCheckReason | null =>
  Object.hasOwn(FILE_ERROR_REASONS, error.code) ? FILE_ERROR_REASONS[error.code] : null;

export const toVideoSearchError = (error: ApiError): VideoSearchError => {
  if (isSearchUnavailableError(error as unknown) || UNAVAILABLE_STATUSES.includes(error.status))
    return { kind: "unavailable", message: videoSearchTexts.unavailableText };
  if (error.code === "VIDEO_TOO_LONG") return { kind: "file", message: videoCheckMessages.tooLong };
  if (error.code === "FILE_CORRUPTED") return { kind: "file", message: videoCheckMessages.corrupted };
  if (toVideoCheckReason(error)) return { kind: "file", message: error.message };
  if (error.code === "RATE_LIMITED")
    return { kind: "server", message: videoSearchTexts.rateLimited(waitTime(error.retryAfter)) };

  return { kind: "server", message: error.message };
};
