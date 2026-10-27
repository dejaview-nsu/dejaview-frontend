import { CircleCheck, FolderUp, Image, Music, RefreshCcw, Trash, Video, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import { type FileConstraints } from "../../lib/files";
import { Button } from "../button";
import { FilePreview } from "../file-preview";

type FileUploadProps = {
  constraints: FileConstraints;
  files: readonly File[];
  onFilesSelected: (files: File[]) => void;
  onRemove: () => void;
  isDisabled?: boolean;
  allowPaste?: boolean;
  appearance?: "default" | "brand";
  actionId?: string;
  fileReady?: boolean;
  onPreviewLoaded?: (file: File) => void;
  prompt?: ReactNode;
  hint?: ReactNode;
  renderSelected?: (files: readonly File[], openPicker: () => void) => ReactNode;
  renderContent?: (openPicker: () => void) => ReactNode;
  inputId?: string;
};

export const FileUpload = ({
  constraints,
  files,
  onFilesSelected,
  onRemove,
  isDisabled,
  allowPaste,
  appearance = "default",
  actionId,
  fileReady = false,
  onPreviewLoaded,
  prompt,
  hint,
  renderSelected,
  renderContent,
  inputId,
}: FileUploadProps) => {
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const isImage = constraints.kind === "image";
  const label = { image: "изображение", video: "видеофрагмент", audio: "аудиофрагмент" }[constraints.kind];
  const Icon = { image: Image, video: Video, audio: Music }[constraints.kind];
  const isCustomSelection = renderSelected !== undefined && files.length > 0;
  const selectedImage = !isCustomSelection && appearance === "brand" && isImage && files.length > 0;
  const openPicker = () => input.current?.click();

  useEffect(() => {
    if (!allowPaste || isDisabled) return;
    const paste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (!files.some((file) => file.type.startsWith("image/"))) return;
      event.preventDefault();
      onFilesSelected(files);
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, [allowPaste, isDisabled, onFilesSelected]);

  return (
    <div>
      <div
        className={cn(
          renderContent
            ? "group text-ink"
            : isCustomSelection
              ? "border-2 border-border-strong bg-input text-ink"
              : [
                  "flex flex-col items-center justify-center border-2 text-center",
                  appearance === "brand"
                    ? "border-border-default bg-input text-ink"
                    : "rounded-xl border-border-base bg-surface-page",
                ],
          isDragging && !isDisabled && "border-link bg-hover",
          isDisabled && "cursor-wait",
          !renderContent &&
            !isCustomSelection &&
            (selectedImage
              ? "gap-4 border-solid border-border-strong p-4 md:flex-row md:gap-6 md:p-5"
              : "min-h-[220px] gap-3 border-dashed p-2.5 md:p-6"),
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!isDisabled) setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = isDisabled ? "none" : "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!isDisabled) onFilesSelected(Array.from(event.dataTransfer.files));
        }}
        role="group"
        data-dragging={isDragging && !isDisabled}
        aria-label={`Загрузка: ${label}`}
        aria-describedby={renderContent || isCustomSelection ? undefined : hintId}
      >
        <input
          ref={input}
          id={inputId}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-label={`Выберите ${label}`}
          accept={constraints.extensions.map((extension) => `.${extension}`).join(",")}
          disabled={isDisabled}
          onChange={(event) => {
            const selected = Array.from(event.currentTarget.files ?? []);
            if (selected.length) onFilesSelected(selected);
            event.currentTarget.value = "";
          }}
        />
        {renderContent ? (
          renderContent(openPicker)
        ) : isCustomSelection ? (
          renderSelected(files, openPicker)
        ) : (
          <>
            {selectedImage && (
              <FilePreview
                file={files[0]}
                className="w-full max-w-[320px] shrink-0 md:w-48"
                onLoaded={onPreviewLoaded}
              />
            )}
            {appearance === "brand" && !selectedImage && (
              <span className="flex size-14 items-center justify-center bg-header text-brand-gold" aria-hidden="true">
                <Icon size={28} strokeWidth={1.75} />
              </span>
            )}
            {files.length === 0 ? (
              <p className="text-base leading-[1.55] font-semibold">
                {prompt ?? <>Перетащи {isImage ? "кадр" : label} сюда или выбери файл</>}
              </p>
            ) : (
              <div
                className={cn(
                  "flex w-full min-w-0 flex-col items-center gap-1.5",
                  selectedImage && "md:items-start md:text-left",
                )}
                aria-live="polite"
              >
                <p className="max-w-full break-all text-base leading-[1.55] font-semibold">{files[0].name}</p>
                <p className="text-sm text-muted">
                  {files[0].name.split(".").at(-1)?.toUpperCase()} · {(files[0].size / (1024 * 1024)).toFixed(2)} МБ
                </p>
                {files.length > 1 && <p className="text-sm">Выбрано файлов: {files.length}. Оставьте один файл.</p>}
                {selectedImage && fileReady && (
                  <p className="flex items-center gap-2 rounded-sm border border-success-text bg-success-bg p-2.5 text-sm text-success-text">
                    <CircleCheck size={16} className="shrink-0" aria-hidden="true" />
                    Файл подходит - можно начинать поиск
                  </p>
                )}
              </div>
            )}
            <div className={cn("flex flex-col items-center gap-2", selectedImage && "w-full shrink-0 md:w-auto")}>
              <Button
                id={actionId}
                variant={appearance === "brand" ? "brand-secondary" : "secondary"}
                isDisabled={isDisabled}
                className={selectedImage ? "w-full md:w-auto" : undefined}
                onPress={openPicker}
              >
                {selectedImage ? (
                  <RefreshCcw size={20} strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <FolderUp size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
                )}
                {files.length ? "Заменить" : "Выбрать файл"}
              </Button>
              {files.length > 0 && (
                <Button
                  variant={appearance === "brand" ? "brand-danger" : "ghost"}
                  isDisabled={isDisabled}
                  onPress={onRemove}
                  aria-label="Удалить файл"
                >
                  {selectedImage ? (
                    <Trash size={20} strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <X size={16} strokeWidth={1.75} aria-hidden="true" />
                  )}{" "}
                  Удалить
                </Button>
              )}
            </div>
            {!selectedImage && (
              <p
                id={hintId}
                className={cn("text-sm leading-[1.5]", appearance === "brand" ? "text-muted" : "text-text-caption")}
              >
                {hint ?? (
                  <>
                    {isImage && "Вставьте одно изображение "}
                    {constraints.extensions.join(", ").toUpperCase()}. Ограничение{" "}
                    {constraints.maxDurationSeconds && `до ${constraints.maxDurationSeconds} секунд и `}
                    до {constraints.maxBytes / (1024 * 1024)} МБ
                    {allowPaste && <span> · Можно вставить из буфера: Ctrl+V или Cmd+V</span>}
                  </>
                )}
              </p>
            )}
          </>
        )}
      </div>
      {selectedImage && (
        <p id={hintId} className="mt-[22px] text-sm leading-[1.5] text-muted">
          Чтобы заменить изображение, перетащи другое сюда, вставь из буфера или нажми «Заменить»
        </p>
      )}
    </div>
  );
};
