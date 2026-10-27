import { useUnit } from "effector-react";
import { CircleAlert, CircleCheck, FolderUp, LoaderCircle, Mic, MicOff, Square, Trash } from "lucide-react";

import { audioCheckMessages, audioConstraints, audioRecordingMessages } from "@/features/search-by-audio";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { FileUpload } from "@/shared/ui/file-upload";

import { useMovieSearchModel } from "../model";
import { AudioPreview } from "./audio-preview";
import { AudioWaveform } from "./audio-waveform";
import { formatDuration } from "./video-preview";

export const AudioInput = ({ fileInputId }: { fileInputId: string }) => {
  const $$model = useMovieSearchModel();
  const { audio, pending, recording, select, start, stop, cancel } = useUnit({
    audio: $$model.outputs.$audio,
    pending: $$model.outputs.$pending,
    recording: $$model.outputs.$recording,
    select: $$model.inputs.filesSelected,
    start: $$model.inputs.recordingStarted,
    stop: $$model.inputs.recordingStopped,
    cancel: $$model.inputs.recordingCancelled,
  });
  const requesting = recording.status === "requesting";
  const capturing = recording.status === "recording";
  const encoding = recording.status === "encoding";
  const ready = recording.status === "idle" && audio.files.length > 0;
  const recordingError = audio.errorKind === "recording";
  const invalid = recordingError || audio.check.status === "invalid";
  const selectFiles = (files: File[]) => select({ mode: "audio", files });
  const Icon = recordingError ? MicOff : Mic;

  return (
    <FileUpload
      appearance="brand"
      actionId="search-file-action"
      inputId={fileInputId}
      constraints={audioConstraints}
      files={audio.files}
      onFilesSelected={selectFiles}
      onRemove={() => selectFiles([])}
      isDisabled={pending || encoding}
      renderContent={(openPicker) => (
        <div
          className={cn(
            "bg-input text-ink group-data-[dragging=true]:border-link",
            ready || capturing || encoding
              ? "border-2 border-border-strong"
              : "flex min-h-60 flex-col items-center justify-center gap-4 border-2 border-dashed border-border-default px-4 py-4 text-center",
            (ready || capturing || encoding) && (capturing ? "p-6 md:p-7" : "p-4 md:p-7"),
            invalid && "border-error-text",
            requesting && "md:py-5",
          )}
        >
          {capturing ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 md:mb-8">
                <p role="status" className="flex items-center gap-2 text-sm md:text-base">
                  <span className="size-2.5 rounded-full bg-terracotta" />
                  Идёт запись…
                </p>
                <span className="text-sm tabular-nums text-muted md:hidden">
                  {formatDuration(recording.seconds)} / 0:10
                </span>
                <p className="w-full text-xs text-muted md:w-auto md:text-sm">Поднесите устройство ближе к звуку</p>
              </div>
              <div className="flex items-center gap-4 md:gap-6">
                <span className="flex size-11 shrink-0 items-center justify-center bg-header text-brand-gold">
                  <Square size={22} aria-hidden="true" />
                </span>
                <AudioWaveform levels={recording.levels} progress={1} />
                <span className="hidden shrink-0 text-sm tabular-nums text-muted md:inline">
                  {formatDuration(recording.seconds)} / 0:10
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Длительность записи"
                aria-valuemin={0}
                aria-valuemax={10}
                aria-valuenow={recording.seconds}
                className="my-4 h-1.5 bg-divider md:mt-8"
              >
                <div className="h-full bg-brand-brown" style={{ width: `${recording.seconds * 10}%` }} />
              </div>
              <div className="flex flex-col gap-2 md:flex-row">
                <Button variant="brand-secondary" onPress={stop}>
                  <Square size={18} aria-hidden="true" />
                  Остановить запись
                </Button>
                <Button variant="brand-ghost" onPress={cancel}>
                  Отменить запись
                </Button>
              </div>
            </>
          ) : ready ? (
            <>
              <AudioPreview file={audio.files[0]} durationSeconds={audio.durationSeconds} disabled={pending} />
              <div aria-live="polite" className="mt-5 mb-3">
                {pending || audio.check.status === "checking" ? (
                  <p className="flex items-center gap-2 text-sm text-muted">
                    <LoaderCircle size={16} className="motion-safe:animate-spin" />
                    {pending ? "Ищем фильм…" : "Проверяем файл…"}
                  </p>
                ) : audio.check.status === "valid" ? (
                  <p className="inline-flex items-center gap-2 border border-success-text bg-success-bg p-2.5 text-sm text-success-text">
                    <CircleCheck size={16} className="shrink-0" />
                    Фрагмент подходит — можно начинать поиск
                  </p>
                ) : audio.check.status === "invalid" ? (
                  <p className="text-sm text-error-text">{audioCheckMessages[audio.check.reason]}</p>
                ) : null}
                {audio.files.length > 1 && (
                  <p className="text-sm text-error-text">Выбрано файлов: {audio.files.length}. Оставьте один файл.</p>
                )}
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:gap-4">
                <Button variant="brand-secondary" isDisabled={pending} onPress={start}>
                  <Mic size={20} aria-hidden="true" />
                  Записать заново
                </Button>
                <Button variant="brand-secondary" isDisabled={pending} onPress={openPicker}>
                  <FolderUp size={20} aria-hidden="true" />
                  Выбрать файл
                </Button>
                <Button variant="brand-danger" isDisabled={pending} onPress={() => selectFiles([])}>
                  <Trash size={18} aria-hidden="true" />
                  Удалить
                </Button>
              </div>
            </>
          ) : encoding ? (
            <p role="status" className="flex min-h-44 items-center justify-center gap-3 text-sm">
              <LoaderCircle className="motion-safe:animate-spin" size={24} />
              Подготавливаем запись…
              <Button variant="brand-ghost" onPress={cancel}>
                Отменить запись
              </Button>
            </p>
          ) : (
            <>
              <span className="flex size-12 items-center justify-center bg-header text-brand-gold">
                <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
              </span>
              {requesting ? (
                <>
                  <p role="status" className="max-w-lg text-base font-semibold">
                    Разрешите доступ к микрофону во всплывающем окне браузера
                  </p>
                  <p className="max-w-lg text-sm text-muted">
                    Окно появится рядом с адресной строкой. Без разрешения записать звук не получится, но можно выбрать
                    файл
                  </p>
                </>
              ) : recordingError ? (
                <p className="flex items-center gap-2 text-base text-error-text">
                  <CircleAlert size={20} aria-hidden="true" />
                  {audio.error === audioRecordingMessages.permission
                    ? "Нет доступа к микрофону"
                    : "Микрофон не записал звук"}
                </p>
              ) : (
                <p className="text-base font-semibold">
                  <span className="hidden md:inline">Перетащите аудиофайл сюда или запишите звук</span>
                  <span className="md:hidden">Выберите аудиофайл или запишите звук</span>
                </p>
              )}
              <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
                <Button
                  id="search-file-action"
                  variant="brand-secondary"
                  className="order-2 md:order-1"
                  onPress={openPicker}
                >
                  <FolderUp size={20} aria-hidden="true" />
                  Выбрать файл
                </Button>
                <Button
                  variant={requesting ? "brand" : "brand-secondary"}
                  className="order-1 md:order-2"
                  isDisabled={requesting}
                  onPress={start}
                >
                  {requesting ? (
                    <LoaderCircle size={20} className="motion-safe:animate-spin" aria-hidden="true" />
                  ) : (
                    <Mic size={20} aria-hidden="true" />
                  )}
                  {requesting ? "Ждём разрешения" : "Записать с микрофона"}
                </Button>
              </div>
              <p className="text-xs leading-[1.5] text-muted md:text-sm">
                MP3, WAV, OGG или M4A · до 20 МБ · до 10 секунд
                <br />
                Запись остановится сама через 10 секунд
              </p>
            </>
          )}
        </div>
      )}
    />
  );
};
