import { CircleCheck, LoaderCircle, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { AudioPreview } from "./audio-preview";
import { formatMegabytes } from "./video-preview";

const Progress = ({ label, value }: { label: string; value: number | null }) => (
  <div
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value ?? undefined}
    className="h-2 overflow-hidden bg-divider"
  >
    <div
      className={cn("h-full bg-brand-brown", value === null && "w-1/4 motion-safe:animate-progress-indeterminate")}
      style={value === null ? undefined : { width: `${value}%` }}
    />
  </div>
);

export const AudioSearchStages = ({
  file,
  durationSeconds,
  stage,
  progress,
  onCancel,
}: {
  file: File;
  durationSeconds: number | null;
  stage: string;
  progress: number | null;
  onCancel: () => void;
}) => {
  const uploading = stage === "uploading";

  return (
    <div className="mx-auto max-w-content">
      <h2
        role="status"
        className="border-b-2 border-border-strong pb-2 font-heading text-mobile-heading-2 font-bold md:text-heading-2 md:font-extrabold"
      >
        {uploading ? "Загружаем аудиофрагмент…" : "Ищем фильм по звуку…"}
      </h2>
      <div className="mt-6 grid gap-4 md:mt-12 md:grid-cols-2 md:gap-6 md:px-5">
        <div
          className={cn(
            "flex flex-col gap-4 border-2 border-border-strong bg-card p-4 md:p-6",
            uploading && "shadow-hard-lg",
          )}
        >
          <p className="font-label text-sm font-semibold tracking-widest text-terracotta-text uppercase">
            Этап 1: загрузка
          </p>
          {uploading ? (
            <p className="text-base">Загружаем фрагмент{progress === null ? "…" : `: ${progress}%`}</p>
          ) : (
            <p className="flex items-center gap-2 text-base text-success-text">
              <CircleCheck size={22} aria-hidden="true" />
              Фрагмент загружен
            </p>
          )}
          <Progress label="Загрузка аудио" value={uploading ? progress : 100} />
          <p className="text-sm text-muted">
            {formatMegabytes(file.size * (uploading ? (progress ?? 0) / 100 : 1))} из {formatMegabytes(file.size)} МБ
          </p>
          {uploading && (
            <Button variant="brand-secondary" className="self-start" onPress={onCancel}>
              <X size={20} aria-hidden="true" />
              Отменить загрузку
            </Button>
          )}
        </div>
        <div
          className={cn(
            "flex flex-col gap-4 border-2 bg-card p-4 md:p-6",
            uploading ? "border-dashed border-divider" : "border-border-strong shadow-hard-lg",
          )}
        >
          <p className="font-label text-sm font-semibold tracking-widest text-terracotta-text uppercase">
            Этап 2: поиск фильма
          </p>
          <p className="flex items-center gap-2 text-sm md:text-base">
            <LoaderCircle
              size={22}
              className={cn("shrink-0", !uploading && "motion-safe:animate-spin")}
              aria-hidden="true"
            />
            {uploading ? "Начнётся сразу после загрузки" : "Сравниваем звук с фильмами каталога"}
          </p>
          {!uploading && (
            <>
              <Progress label="Поиск фильма по звуку" value={null} />
              <Button variant="brand-secondary" className="self-start" onPress={onCancel}>
                <X size={20} aria-hidden="true" />
                Отменить поиск
              </Button>
            </>
          )}
        </div>
      </div>
      {!uploading && (
        <div className="mt-8 grid gap-6 md:mt-14 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-8 md:px-2.5">
          <div className="hidden flex-col gap-3 md:flex">
            <p className="font-label text-sm font-semibold tracking-widest text-muted uppercase">Ваш фрагмент</p>
            <AudioPreview compact file={file} durationSeconds={durationSeconds} />
          </div>
          <div
            aria-hidden="true"
            className="flex gap-6 border-2 border-border-strong bg-card p-6 motion-safe:animate-pulse md:min-h-[360px]"
          >
            <div className="aspect-[2/3] w-28 shrink-0 bg-hover md:w-[200px]" />
            <div className="flex flex-1 flex-col gap-4">
              <div className="h-8 w-4/5 bg-hover" />
              <div className="h-4 w-2/5 bg-hover" />
              <div className="mt-6 h-4 bg-hover" />
              <div className="h-4 bg-hover" />
              <div className="h-4 w-4/5 bg-hover" />
              <div className="mt-auto h-12 w-3/5 bg-hover" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
