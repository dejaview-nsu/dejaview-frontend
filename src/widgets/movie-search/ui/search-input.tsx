import { useUnit } from "effector-react";

import { fileConstraints } from "@/features/search-by-file";

import { FileUpload } from "@/shared/ui/file-upload";

import { useMovieSearchModel } from "../model";
import { TextDescription } from "./text-description";

export const SearchInput = () => {
  const $$model = useMovieSearchModel();
  const { mode, media, pending, selectFiles, previewLoaded } = useUnit({
    mode: $$model.outputs.$mode,
    media: $$model.outputs.$currentMedia,
    pending: $$model.outputs.$pending,
    selectFiles: $$model.inputs.filesSelected,
    previewLoaded: $$model.inputs.imagePreviewLoaded,
  });

  return (
    <>
      <p className="mb-4 font-label text-sm leading-[1.2] font-semibold tracking-widest text-terracotta-text uppercase md:mb-[22px]">
        Шаг 2: {mode === "text" ? "опиши" : "загрузи"}
      </p>
      {mode === "text" && <TextDescription />}
      {(mode === "image" || mode === "video") && (
        <FileUpload
          appearance="brand"
          actionId="search-file-action"
          key={mode}
          constraints={fileConstraints[mode]}
          files={media.files}
          onFilesSelected={(files) => selectFiles({ mode, files })}
          onRemove={() => selectFiles({ mode, files: [] })}
          isDisabled={pending}
          allowPaste={mode === "image"}
          fileReady={media.fileReady}
          onPreviewLoaded={mode === "image" ? previewLoaded : undefined}
        />
      )}
      {mode === "audio" && (
        <p className="mt-3 text-sm leading-normal text-muted">
          Поиск по аудиофрагменту появится в следующем обновлении.
        </p>
      )}
    </>
  );
};
