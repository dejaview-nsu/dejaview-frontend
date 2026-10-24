import { type ApiError, isSearchUnavailableError } from "@/shared/api";

import { audioCheckMessages, type AudioCheckReason } from "../config/audio";

export type AudioSearchError = { kind: "missing" | "file" | "recording" | "server" | "unavailable"; message: string };

const FILE_ERROR_REASONS: Record<string, AudioCheckReason> = {
  FILE_REQUIRED: "missing",
  TOO_MANY_FILES: "multiple",
  FILE_TOO_LARGE: "tooLarge",
  UNSUPPORTED_FORMAT: "format",
  AUDIO_TOO_LONG: "tooLong",
  FILE_CORRUPTED: "corrupted",
};

export const toAudioCheckReason = (error: ApiError): AudioCheckReason | null =>
  Object.hasOwn(FILE_ERROR_REASONS, error.code) ? FILE_ERROR_REASONS[error.code] : null;

export const toAudioSearchError = (error: ApiError): AudioSearchError => {
  if (isSearchUnavailableError(error as unknown) || [502, 503, 504].includes(error.status))
    return {
      kind: "unavailable",
      message: "Поиск временно недоступен. Попробуйте через несколько минут — аудиофрагмент сохранится.",
    };

  const reason = toAudioCheckReason(error);

  if (reason) return { kind: reason === "missing" ? "missing" : "file", message: audioCheckMessages[reason] };

  return { kind: "server", message: error.message };
};
