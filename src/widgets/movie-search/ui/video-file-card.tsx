import { CircleAlert, CircleCheck, LoaderCircle, RefreshCw, Trash } from "lucide-react";

import { videoUploadTexts } from "@/features/search-by-video";

import { getFileExtension } from "@/shared/lib/files";
import { Button } from "@/shared/ui/button";

import { formatDuration, formatMegabytes, VideoPreview } from "./video-preview";

export type VideoFileStatus = "none" | "ready" | "invalid" | "checking" | "uploading" | "processing";

const progressTexts = {
  checking: videoUploadTexts.checking,
  uploading: videoUploadTexts.uploading,
  processing: videoUploadTexts.processing,
};

const FileStatus = ({ status, message }: { status: VideoFileStatus; message?: string }) => {
  if (status === "ready")
    return (
      <p className="inline-flex items-center gap-2 rounded-sm border border-success-text bg-success-bg px-3 py-2 text-left text-sm leading-[1.4] text-success-text">
        <CircleCheck className="shrink-0" size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className="md:hidden">
          {videoUploadTexts.fileFitsMobile[0]}
          <br />
          {videoUploadTexts.fileFitsMobile[1]}
        </span>
        <span className="hidden md:inline">{videoUploadTexts.fileFits}</span>
      </p>
    );

  if (status === "invalid" && message)
    return (
      <p className="inline-flex items-center gap-2 rounded-sm border border-error-text bg-error-bg px-3 py-2 text-left text-sm leading-[1.4] text-error-text">
        <CircleAlert className="shrink-0" size={16} strokeWidth={1.75} aria-hidden="true" />
        {message}
      </p>
    );

  if (status === "checking" || status === "uploading" || status === "processing")
    return (
      <p className="inline-flex items-center gap-2 py-2 text-sm leading-[1.4] text-muted">
        <LoaderCircle className="shrink-0 motion-safe:animate-spin" size={16} strokeWidth={1.75} aria-hidden="true" />
        {progressTexts[status]}
      </p>
    );

  return null;
};

export const VideoFileCard = ({
  file,
  durationSeconds,
  status,
  message,
  isBusy,
  actionId,
  onReplace,
  onRemove,
}: {
  file: File;
  durationSeconds: number | null;
  status: VideoFileStatus;
  message?: string;
  isBusy: boolean;
  actionId?: string;
  onReplace: () => void;
  onRemove: () => void;
}) => {
  const meta = [
    getFileExtension(file).toUpperCase(),
    durationSeconds === null ? null : formatDuration(durationSeconds),
    `${formatMegabytes(file.size)} МБ`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col items-center gap-4 p-4 text-center md:flex-row md:gap-10 md:px-7 md:py-6 md:text-left">
      <VideoPreview file={file} durationSeconds={durationSeconds} className="max-w-48 md:w-48 md:shrink-0" />

      <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-2 md:items-start">
        <p className="max-w-full text-base leading-[1.55] font-semibold break-all">{file.name}</p>
        <p className="text-sm leading-[1.5] text-muted">{meta}</p>
        <div role="status" aria-live="polite">
          <FileStatus status={status} message={message} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 md:flex-col md:flex-nowrap md:gap-2">
        <Button id={actionId} variant="brand-secondary" className="px-4" isDisabled={isBusy} onPress={onReplace}>
          <RefreshCw size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
          {videoUploadTexts.replace}
        </Button>
        <Button variant="brand-danger" isDisabled={isBusy} onPress={onRemove}>
          <Trash size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
          {videoUploadTexts.remove}
        </Button>
      </div>
    </div>
  );
};
