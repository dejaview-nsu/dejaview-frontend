import type { TransportTimeouts } from "../transport/types";

type FileSearchModeConfig = {
  path: string;
  timeouts: Required<TransportTimeouts>;
};

export const FILE_SEARCH_MODES = {
  image: { path: "/search/image", timeouts: { upload: 15_000, response: 20_000 } },
  video: { path: "/search/video", timeouts: { upload: 90_000, response: 30_000 } },
} as const satisfies Record<string, FileSearchModeConfig>;

export type FileSearchMode = keyof typeof FILE_SEARCH_MODES;
