import { useUnit } from "effector-react";
import { RefreshCw } from "lucide-react";

import { videoCheckTitle, videoSearchTexts } from "@/features/search-by-video";

import { useMovieSearchModel } from "../model";
import { SearchNotice } from "./search-notice";
import { VideoSearchEmpty } from "./video-search-empty";
import { VideoSearchResult } from "./video-search-result";
import { VideoSearchStages } from "./video-search-stages";

export const VideoSearchOutput = ({ fileInputId }: { fileInputId: string }) => {
  const $$model = useMovieSearchModel();
  const { video, search, cancel } = useUnit({
    video: $$model.outputs.$video,
    search: $$model.inputs.searchPressed,
    cancel: $$model.inputs.searchCancelled,
  });
  const file = video.files[0] ?? null;

  if ((video.stage === "uploading" || video.stage === "processing") && file)
    return (
      <VideoSearchStages
        stage={video.stage}
        progress={video.progress}
        file={file}
        durationSeconds={video.durationSeconds}
        onCancel={cancel}
      />
    );

  if (video.error && video.errorKind === "unavailable")
    return (
      <SearchNotice
        tone="warning"
        title={videoSearchTexts.unavailableTitle}
        message={video.error}
        actionLabel={videoSearchTexts.retry}
        ActionIcon={RefreshCw}
        onAction={search}
      />
    );

  if (video.error && video.errorKind === "server")
    return (
      <SearchNotice
        tone="error"
        title={videoCheckTitle}
        message={video.error}
        actionLabel={videoSearchTexts.retry}
        ActionIcon={RefreshCw}
        onAction={search}
      />
    );

  if (video.error)
    return (
      <SearchNotice
        tone="error"
        title={videoCheckTitle}
        message={video.error}
        actionLabel={video.errorKind === "missing" ? videoSearchTexts.chooseFile : videoSearchTexts.chooseAnotherFile}
        fileInputId={fileInputId}
      />
    );

  if (video.isEmpty) return <VideoSearchEmpty fileInputId={fileInputId} onSearchAgain={search} />;

  if (video.result)
    return <VideoSearchResult movie={video.result} file={file} durationSeconds={video.durationSeconds} />;

  return null;
};
