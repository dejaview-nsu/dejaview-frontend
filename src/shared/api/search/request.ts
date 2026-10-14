import type { SearchResponse } from "../generated";
import { zSearchResponse } from "../generated/zod.gen";
import { sendApiRequest, type UnauthorizedPolicy } from "../request";
import { FILE_SEARCH_MODES, type FileSearchMode } from "./modes";

export const searchByText = ({ query, signal }: { query: string; signal?: AbortSignal }): Promise<SearchResponse> =>
  sendApiRequest({
    method: "POST",
    path: "/search/text",
    body: { query },
    timeouts: { response: 10_000 },
    schema: zSearchResponse,
    isSearch: true,
    signal,
  });

export type SearchByFileParams = {
  mode: FileSearchMode;
  file: File;
  signal?: AbortSignal;
  onUploadProgress?: (fraction: number | null) => void;
  onUploadComplete?: () => void;
  onUnauthorized?: UnauthorizedPolicy;
};

export const searchByFile = ({
  mode,
  file,
  signal,
  onUploadProgress,
  onUploadComplete,
  onUnauthorized,
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
    onUnauthorized,
  });
};
