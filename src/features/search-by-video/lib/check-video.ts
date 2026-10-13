import { getFileExtension, readVideoDuration } from "@/shared/lib/files";

import { type VideoCheckReason, videoConstraints } from "../config";

export type VideoCheckResult =
  { ok: true; file: File; durationSeconds: number } | { ok: false; reason: VideoCheckReason; durationSeconds?: number };

const hasSupportedFormat = (file: File) =>
  videoConstraints.extensions.includes(getFileExtension(file)) &&
  (file.type === "" || videoConstraints.mimeTypes.includes(file.type));

export const checkVideo = async (
  files: readonly File[],
  readDuration: (file: File) => Promise<number> = readVideoDuration,
): Promise<VideoCheckResult> => {
  if (files.length === 0) return { ok: false, reason: "missing" };
  if (files.length > 1) return { ok: false, reason: "multiple" };

  const [file] = files;

  if (file.size > videoConstraints.maxBytes) return { ok: false, reason: "tooLarge" };
  if (!hasSupportedFormat(file)) return { ok: false, reason: "format" };

  let durationSeconds: number;

  try {
    durationSeconds = await readDuration(file);
  } catch {
    return { ok: false, reason: "corrupted" };
  }

  if (videoConstraints.maxDurationSeconds && durationSeconds > videoConstraints.maxDurationSeconds)
    return { ok: false, reason: "tooLong", durationSeconds };

  return { ok: true, file, durationSeconds };
};
