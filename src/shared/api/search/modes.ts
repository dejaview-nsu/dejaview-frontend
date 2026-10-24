import type { TransportTimeouts } from "../transport/types";

type FileSearchModeConfig = {
  path: string;
  timeouts: Required<TransportTimeouts>;
  fileTooLargeMessage: string;
};

export const FILE_SEARCH_MODES = {
  audio: {
    path: "/search/audio",
    timeouts: { upload: 30_000, response: 20_000 },
    fileTooLargeMessage: "Невозможно выполнить поиск по аудиофрагменту: размер файла больше 20 МБ",
  },
  image: {
    path: "/search/image",
    timeouts: { upload: 15_000, response: 20_000 },
    fileTooLargeMessage: "Невозможно выполнить поиск по изображению: размер файла больше 10 МБ",
  },
  video: {
    path: "/search/video",
    timeouts: { upload: 90_000, response: 30_000 },
    fileTooLargeMessage: "Невозможно выполнить поиск по видеофрагменту: размер файла больше 50 МБ",
  },
} as const satisfies Record<string, FileSearchModeConfig>;

export type FileSearchMode = keyof typeof FILE_SEARCH_MODES;
