import { useUnit } from "effector-react";

import { fileConstraints } from "@/features/search-by-file";
import { type VideoCheck, videoCheckChips, videoConstraints, videoUploadTexts } from "@/features/search-by-video";

import { FileUpload } from "@/shared/ui/file-upload";

import { useMovieSearchModel } from "../model";
import { AudioInput } from "./audio-input";
import { TextDescription } from "./text-description";
import { VideoFileCard, type VideoFileStatus } from "./video-file-card";

type VideoState = { stage: string; check: VideoCheck };

const videoFileStatus = ({ stage, check }: VideoState): VideoFileStatus => {
  if (stage === "validating" || check.status === "checking") return "checking";
  if (stage === "uploading" || stage === "processing") return stage;
  if (check.status === "valid") return "ready";
  if (check.status === "invalid") return "invalid";
  return "none";
};

export const SearchInput = ({ fileInputId }: { fileInputId: string }) => {
  const $$model = useMovieSearchModel();
  const { mode, image, video, pending, selectFiles, previewLoaded } = useUnit({
    mode: $$model.outputs.$mode,
    image: $$model.outputs.$image,
    video: $$model.outputs.$video,
    pending: $$model.outputs.$pending,
    selectFiles: $$model.inputs.filesSelected,
    previewLoaded: $$model.inputs.imagePreviewLoaded,
  });

  return (
    <>
      <p className="mb-4 font-label text-sm leading-[1.2] font-semibold tracking-widest text-terracotta-text uppercase md:mb-[22px]">
        Шаг 2: {{ text: "опиши", image: "загрузи", video: "загрузи", audio: "загрузи или запиши" }[mode]}
      </p>
      {mode === "text" && <TextDescription />}
      {mode === "image" && (
        <FileUpload
          appearance="brand"
          actionId="search-file-action"
          key={mode}
          constraints={fileConstraints[mode]}
          files={image.files}
          onFilesSelected={(files) => selectFiles({ mode, files })}
          onRemove={() => selectFiles({ mode, files: [] })}
          isDisabled={pending}
          allowPaste
          fileReady={image.fileReady}
          onPreviewLoaded={previewLoaded}
        />
      )}
      {mode === "video" && (
        <>
          <FileUpload
            appearance="brand"
            actionId="search-file-action"
            key={mode}
            constraints={videoConstraints}
            files={video.files}
            onFilesSelected={(files) => selectFiles({ mode, files })}
            onRemove={() => selectFiles({ mode, files: [] })}
            isDisabled={pending}
            inputId={fileInputId}
            prompt={
              <>
                <span className="md:hidden">{videoUploadTexts.promptMobile}</span>
                <span className="hidden md:inline">{videoUploadTexts.prompt}</span>
              </>
            }
            hint={
              <>
                <span className="md:hidden">
                  {videoUploadTexts.hintMobile[0]}
                  <br />
                  {videoUploadTexts.hintMobile[1]}
                </span>
                <span className="hidden md:inline">{videoUploadTexts.hint}</span>
              </>
            }
            renderSelected={(files, openPicker) => (
              <VideoFileCard
                file={files[0]}
                durationSeconds={video.durationSeconds}
                status={videoFileStatus(video)}
                message={video.check.status === "invalid" ? videoCheckChips[video.check.reason] : undefined}
                isBusy={pending}
                actionId="search-file-action"
                onReplace={openPicker}
                onRemove={() => selectFiles({ mode, files: [] })}
              />
            )}
          />
          {video.files.length > 0 && !pending && (
            <p className="mt-3 hidden text-sm leading-[1.5] text-muted md:block">{videoUploadTexts.replaceHint}</p>
          )}
        </>
      )}
      {mode === "audio" && <AudioInput fileInputId={fileInputId} />}
    </>
  );
};
