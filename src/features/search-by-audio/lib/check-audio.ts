import { getFileExtension } from "@/shared/lib/files";

import { type AudioCheckReason, audioConstraints } from "../config/audio";

export type AudioCheckResult =
  { ok: true; file: File; durationSeconds: number } | { ok: false; reason: AudioCheckReason; durationSeconds?: number };

export const readAudioDuration = async (file: File): Promise<number> => {
  const context = new AudioContext();

  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    return buffer.duration;
  } finally {
    await context.close();
  }
};

export const checkAudio = async (
  files: readonly File[],
  readDuration: (file: File) => Promise<number> = readAudioDuration,
): Promise<AudioCheckResult> => {
  if (files.length === 0) return { ok: false, reason: "missing" };
  if (files.length > 1) return { ok: false, reason: "multiple" };

  const [file] = files;

  if (file.size > audioConstraints.maxBytes) return { ok: false, reason: "tooLarge" };
  if (
    !audioConstraints.extensions.includes(getFileExtension(file)) ||
    (file.type && !audioConstraints.mimeTypes.includes(file.type))
  )
    return { ok: false, reason: "format" };
  if (file.size === 0) return { ok: false, reason: "corrupted" };

  try {
    const durationSeconds = await readDuration(file);

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return { ok: false, reason: "corrupted" };
    if (durationSeconds > 10) return { ok: false, reason: "tooLong", durationSeconds };

    return { ok: true, file, durationSeconds };
  } catch {
    return { ok: false, reason: "corrupted" };
  }
};
