import { useUnit } from "effector-react";
import { Mic, RefreshCw, SearchX } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { FilePickerButton } from "@/shared/ui/file-upload";

import { useMovieSearchModel } from "../model";
import { AudioSearchResult } from "./audio-search-result";
import { AudioSearchStages } from "./audio-search-stages";
import { SearchNotice } from "./search-notice";

export const AudioSearchOutput = ({ fileInputId }: { fileInputId: string }) => {
  const $$model = useMovieSearchModel();
  const { audio, pending, search, cancel, record } = useUnit({
    audio: $$model.outputs.$audio,
    pending: $$model.outputs.$pending,
    search: $$model.inputs.searchPressed,
    cancel: $$model.inputs.searchCancelled,
    record: $$model.inputs.recordingStarted,
  });
  const file = audio.files[0] ?? null;

  if (pending && file)
    return (
      <AudioSearchStages
        file={file}
        durationSeconds={audio.durationSeconds}
        stage={audio.stage}
        progress={audio.progress}
        onCancel={cancel}
      />
    );

  if (audio.error) {
    if (audio.errorKind === "recording")
      return (
        <SearchNotice
          tone="error"
          title="Не получилось начать запись"
          message={audio.error}
          actionLabel="Попробовать снова"
          ActionIcon={Mic}
          onAction={record}
          additionalAction={
            <FilePickerButton inputId={fileInputId} variant="brand-secondary">
              <RefreshCw size={20} aria-hidden="true" />
              Выбрать файл
            </FilePickerButton>
          }
        />
      );
    if (audio.errorKind === "server" || audio.errorKind === "unavailable")
      return (
        <SearchNotice
          tone={audio.errorKind === "unavailable" ? "warning" : "error"}
          title={audio.errorKind === "unavailable" ? "Поиск временно недоступен" : "Не получилось выполнить поиск"}
          message={audio.error}
          actionLabel="Повторить"
          ActionIcon={RefreshCw}
          onAction={search}
        />
      );
    return (
      <SearchNotice
        tone="error"
        title="Не получилось начать поиск"
        message={audio.error}
        actionLabel="Выбрать файл"
        fileInputId={fileInputId}
      />
    );
  }

  if (audio.isEmpty)
    return (
      <div
        role="status"
        className="mx-auto flex max-w-content flex-col gap-4 border-2 border-border-strong bg-card p-4 shadow-hard-lg md:flex-row md:gap-8 md:p-8"
      >
        <span className="flex size-14 shrink-0 items-center justify-center bg-header text-brand-gold md:size-[72px]">
          <SearchX size={28} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="font-heading text-mobile-heading-3 font-bold md:text-heading-2">Не удалось узнать фильм</h2>
          <p className="text-base leading-[1.55]">
            Возможно, этого фильма пока нет в нашем каталоге или в записи слишком много шума. Попробуйте другой
            фрагмент.
          </p>
          <h3 className="mt-1 font-label text-sm font-semibold tracking-widest text-terracotta-text uppercase">
            Что может помочь
          </h3>
          <ul className="list-disc pl-5 text-base leading-[1.55] text-muted">
            <li>запись без посторонних разговоров и шума;</li>
            <li>реплика героя или узнаваемая мелодия из фильма;</li>
            <li>звук из самого фильма, а не кавер или ремикс.</li>
          </ul>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button variant="brand" onPress={record}>
              <Mic size={20} aria-hidden="true" />
              Записать заново
            </Button>
            <FilePickerButton inputId={fileInputId} variant="brand-secondary">
              Выбрать другой файл
            </FilePickerButton>
            <Button variant="brand-secondary" onPress={search}>
              Искать снова
            </Button>
          </div>
        </div>
      </div>
    );

  if (audio.result)
    return <AudioSearchResult movie={audio.result} file={file} durationSeconds={audio.durationSeconds} />;
  return null;
};
