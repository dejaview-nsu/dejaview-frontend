import { FolderUp, Image, Video, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import { type FileConstraints } from "../../lib/files";
import { Button } from "../button";

type FileUploadProps = {
  constraints: FileConstraints;
  files: readonly File[];
  onFilesSelected: (files: File[]) => void;
  onRemove: () => void;
  isDisabled?: boolean;
  allowPaste?: boolean;
  appearance?: "default" | "brand";
  actionId?: string;
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
}: FileUploadProps) => {
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const isImage = constraints.kind === "image";
  const label = isImage ? "изображение" : "видеофрагмент";
  const Icon = isImage ? Image : Video;

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
    <div
      className={cn(
        "flex min-h-[235px] flex-col items-center justify-center gap-3 border-2 border-dashed p-2.5 text-center",
        appearance === "brand"
          ? "border-border-default bg-input text-ink"
          : "rounded-xl border-border-base bg-surface-page",
        isDragging && !isDisabled && "border-link bg-hover",
        isDisabled && "cursor-wait",
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
      aria-label={`Загрузка: ${label}`}
      aria-describedby={hintId}
    >
      <input
        ref={input}
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
      {appearance === "brand" && (
        <span className="flex size-14 items-center justify-center bg-header text-brand-gold" aria-hidden="true">
          <Icon size={28} strokeWidth={1.75} />
        </span>
      )}
      {files.length === 0 ? (
        <p className="text-base leading-[1.55] font-semibold">
          Перетащи {label} сюда
          <br />
          или выбери файл
        </p>
      ) : (
        <div className="flex w-full min-w-0 flex-col items-center gap-1.5" aria-live="polite">
          <p className="max-w-full break-all text-base leading-[1.55] font-semibold">{files[0].name}</p>
          <p className="text-sm text-muted">{(files[0].size / (1024 * 1024)).toFixed(2)} МБ</p>
          {files.length > 1 && <p className="text-sm">Выбрано файлов: {files.length}. Оставьте один файл.</p>}
        </div>
      )}
      <Button
        id={actionId}
        variant={appearance === "brand" ? "brand-secondary" : "secondary"}
        isDisabled={isDisabled}
        onPress={() => input.current?.click()}
      >
        <FolderUp size={24} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
        {files.length ? "Заменить файл" : "Выбрать файл"}
      </Button>
      <p
        id={hintId}
        className={cn("text-sm leading-[1.5]", appearance === "brand" ? "text-muted" : "text-text-caption")}
      >
        {constraints.extensions.join(", ").toUpperCase()} ·{" "}
        {constraints.maxDurationSeconds && `до ${constraints.maxDurationSeconds} секунд и `}
        до {constraints.maxBytes / (1024 * 1024)} МБ
        {allowPaste && <span className="mt-1 block">Можно вставить изображение с помощью Ctrl+V или Cmd+V</span>}
      </p>
      {files.length > 0 && (
        <Button variant={appearance === "brand" ? "brand-ghost" : "ghost"} isDisabled={isDisabled} onPress={onRemove}>
          <X size={16} strokeWidth={1.75} aria-hidden="true" /> Удалить файл
        </Button>
      )}
    </div>
  );
};
