import { type FileConstraints } from "@/shared/lib/files";

export const audioConstraints: FileConstraints = {
  kind: "audio",
  extensions: ["mp3", "wav", "ogg", "m4a"],
  mimeTypes: [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/ogg",
    "application/ogg",
    "audio/mp4",
    "audio/x-m4a",
  ],
  maxBytes: 20 * 1024 * 1024,
  maxDurationSeconds: 10,
};

export type AudioCheckReason = "missing" | "multiple" | "tooLarge" | "format" | "tooLong" | "corrupted";

export const audioCheckMessages: Record<AudioCheckReason, string> = {
  missing: "Сначала добавьте аудиофрагмент: выберите файл или запишите звук с микрофона.",
  multiple: "Можно искать только по одному аудиофрагменту. Выберите один файл.",
  tooLarge: "Файл больше 20 МБ. Сожмите аудио или выберите другой файл.",
  format: "Этот формат не подходит. Загрузите аудио в формате MP3, WAV, OGG или M4A.",
  tooLong: "Фрагмент длиннее 10 секунд. Обрежьте аудио или выберите другой файл.",
  corrupted: "Не удалось открыть аудио — возможно, файл повреждён. Попробуйте другой файл.",
};

export const audioRecordingMessages = {
  noSignal:
    "Микрофон не записал звук. Проверьте выбранный микрофон и доступ к нему в браузере, затем запишите фрагмент заново или выберите файл.",
  permission: "Нет доступа к микрофону. Разрешите доступ в настройках браузера и попробуйте снова или выберите файл.",
  unavailable: "Не удалось начать запись. Проверьте подключение микрофона и попробуйте снова или выберите файл.",
  unsupported: "Запись недоступна в этом браузере. Откройте страницу по HTTPS в Chrome или Firefox либо выберите файл.",
  encoding: "Не удалось обработать запись. Запишите фрагмент заново или выберите файл.",
};
