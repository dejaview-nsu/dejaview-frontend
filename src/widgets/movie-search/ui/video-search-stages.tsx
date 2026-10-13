import { CircleCheck, Hourglass, LoaderCircle, X } from "lucide-react";
import { type ReactNode } from "react";

import { videoSearchTexts } from "@/features/search-by-video";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { formatMegabytes, VideoPreview } from "./video-preview";

type StageState = "active" | "done" | "waiting";

const ProgressBar = ({ label, value }: { label: string; value: number | null }) => (
  <div
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value ?? undefined}
    className="h-2.5 w-full overflow-hidden bg-hover"
  >
    {value === null ? (
      <div className="h-full w-1/4 bg-brand-brown motion-safe:animate-progress-indeterminate" />
    ) : (
      <div className="h-full bg-brand-brown transition-[width] duration-300" style={{ width: `${value}%` }} />
    )}
  </div>
);

const StageCard = ({ state, label, children }: { state: StageState; label: string; children: ReactNode }) => (
  <div
    className={cn(
      "flex min-w-0 flex-col gap-4 p-4 md:p-6",
      state === "waiting" ? "border-2 border-dashed border-divider" : "border-2 border-border-strong bg-card",
      state === "active" && "shadow-hard-lg",
    )}
  >
    <p
      className={cn(
        "font-label text-sm leading-[1.2] font-semibold tracking-widest uppercase",
        state === "waiting" ? "text-muted" : "text-terracotta-text",
      )}
    >
      {label}
    </p>
    {children}
  </div>
);

const ResultSkeleton = () => (
  <div aria-hidden="true" className="border-2 border-border-strong bg-card p-4 motion-safe:animate-pulse md:p-6">
    <div className="flex gap-4 md:gap-8">
      <div className="aspect-[2/3] w-28 shrink-0 rounded-sm bg-hover md:w-48" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="h-6 w-3/4 bg-hover md:h-8" />
        <div className="h-4 w-1/2 bg-hover" />
        <div className="mt-6 hidden flex-col gap-3 md:flex">
          <div className="h-4 w-11/12 bg-hover" />
          <div className="h-4 w-full bg-hover" />
          <div className="h-4 w-full bg-hover" />
        </div>
        <div className="mt-auto hidden h-11 w-1/2 bg-hover md:block" />
      </div>
    </div>
    <div className="mt-6 flex flex-col gap-3 md:hidden">
      <div className="h-4 w-full bg-hover" />
      <div className="h-4 w-2/3 bg-hover" />
      <div className="mt-2 h-11 w-full bg-hover" />
    </div>
  </div>
);

export const VideoSearchStages = ({
  stage,
  progress,
  file,
  durationSeconds,
  onCancel,
}: {
  stage: "uploading" | "processing";
  progress: number | null;
  file: File;
  durationSeconds: number | null;
  onCancel: () => void;
}) => {
  const uploading = stage === "uploading";
  const total = formatMegabytes(file.size);
  const loaded = progress === null ? null : formatMegabytes((file.size * progress) / 100);

  return (
    <div className="mx-auto max-w-content">
      <div role="status" aria-live="polite" className="border-b-2 border-border-strong pb-2">
        <h2 className="font-heading text-mobile-heading-2 font-bold md:text-heading-2 md:font-extrabold">
          {uploading ? videoSearchTexts.uploadingTitle : videoSearchTexts.processingTitle}
        </h2>
      </div>

      <div className="mt-6 grid gap-4 md:mt-12 md:grid-cols-2 md:gap-6 md:px-5">
        <StageCard state={uploading ? "active" : "done"} label={videoSearchTexts.uploadStage}>
          {uploading ? (
            <p className="font-heading text-heading-1 font-bold">
              {progress === null ? (
                <LoaderCircle
                  className="motion-safe:animate-spin"
                  size={40}
                  strokeWidth={1.75}
                  aria-label={videoSearchTexts.uploadingTitle}
                />
              ) : (
                `${progress}%`
              )}
            </p>
          ) : (
            <p className="flex items-center gap-2 text-base leading-[1.55] font-semibold text-success-text">
              <CircleCheck className="shrink-0" size={24} strokeWidth={1.75} aria-hidden="true" />
              {videoSearchTexts.uploadDone}
            </p>
          )}
          <ProgressBar label={videoSearchTexts.uploadStage} value={uploading ? progress : 100} />
          {loaded !== null && (
            <p className="text-sm leading-[1.5] text-muted">
              {uploading ? loaded : total} из {total} МБ
            </p>
          )}
          {uploading && (
            <Button variant="brand-secondary" className="w-full px-4 md:w-auto md:self-start" onPress={onCancel}>
              <X size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
              {videoSearchTexts.cancelUpload}
            </Button>
          )}
        </StageCard>

        <StageCard state={uploading ? "waiting" : "active"} label={videoSearchTexts.searchStage}>
          {uploading ? (
            <>
              <Hourglass className="text-muted" size={32} strokeWidth={1.75} aria-hidden="true" />
              <p className="text-base leading-[1.55] text-muted">{videoSearchTexts.searchWaiting}</p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 text-base leading-[1.55]">
                <LoaderCircle
                  className="shrink-0 text-muted motion-safe:animate-spin"
                  size={24}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {videoSearchTexts.searchRunning}
              </p>
              <ProgressBar label={videoSearchTexts.searchStage} value={null} />
              <Button variant="brand-secondary" className="w-full px-4 md:w-auto md:self-start" onPress={onCancel}>
                <X size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
                {videoSearchTexts.cancelSearch}
              </Button>
            </>
          )}
        </StageCard>
      </div>

      {!uploading && (
        <div className="mt-8 grid gap-6 md:mt-14 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-8">
          <div className="hidden flex-col gap-3 md:flex">
            <p className="font-label text-sm leading-[1.2] font-semibold tracking-widest text-muted uppercase">
              {videoSearchTexts.fragment}
            </p>
            <VideoPreview file={file} durationSeconds={durationSeconds} size="large" />
          </div>
          <ResultSkeleton />
        </div>
      )}
    </div>
  );
};
