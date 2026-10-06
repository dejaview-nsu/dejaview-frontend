import type { SearchResponse } from "../generated";
import { zSearchResponse } from "../generated/zod.gen";
import { sendApiRequest } from "../request";
import { FILE_SEARCH_MODES, type FileSearchMode } from "./modes";

export type SearchByFileParams = {
  mode: FileSearchMode;
  file: File;
  signal?: AbortSignal;
  onUploadProgress?: (fraction: number | null) => void;
  onUploadComplete?: () => void;
};

export const searchByFile = ({
  mode,
  file,
  signal,
  onUploadProgress,
  onUploadComplete,
}: SearchByFileParams): Promise<SearchResponse> => {
  const { path, timeouts, fileTooLargeMessage } = FILE_SEARCH_MODES[mode];
  const body = new FormData();

  body.append("file", file);

  return sendApiRequest({
    method: "POST",
    path,
    body,
    timeouts,
    schema: zSearchResponse,
    isSearch: true,
    errorMessages: { FILE_TOO_LARGE: fileTooLargeMessage },
    signal,
    onUploadProgress,
    onUploadComplete,
  });
};
