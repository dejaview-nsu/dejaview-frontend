import { useUnit } from "effector-react";

import { Button } from "@/shared/ui/button";

import { useMovieSearchModel } from "../model";
import { SearchButton } from "./search-button";

export const SearchActions = () => {
  const $$model = useMovieSearchModel();
  const { mode, video, pending, recordingBusy, search, cancel } = useUnit({
    mode: $$model.outputs.$mode,
    video: $$model.outputs.$video,
    pending: $$model.outputs.$pending,
    recordingBusy: $$model.outputs.$recordingBusy,
    search: $$model.inputs.searchPressed,
    cancel: $$model.inputs.searchCancelled,
  });
  const isVideo = mode === "video";

  return (
    <div className="mt-4 flex flex-col items-center gap-3 p-2.5 md:mt-[22px]">
      <SearchButton
        pending={pending}
        pendingLabel={isVideo && video.stage === "uploading" ? "Загружаем…" : undefined}
        isDisabled={mode === "audio" && recordingBusy}
        onPress={search}
      />
      {pending && mode !== "audio" && (!isVideo || video.stage === "validating") && (
        <Button variant="brand-ghost" onPress={cancel}>
          Отменить поиск
        </Button>
      )}
    </div>
  );
};
