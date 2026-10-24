import { useUnit } from "effector-react";

import { MovieMatchCard } from "@/entities/movie";

import { type MovieSearchResult } from "@/shared/api";
import { FilePreview } from "@/shared/ui/file-preview";

import { useMovieSearchModel } from "../model";

export const ImageSearchResult = ({ movie }: { movie: MovieSearchResult }) => {
  const $$model = useMovieSearchModel();
  const { files } = useUnit($$model.outputs.$image);

  return (
    <div className="mx-auto max-w-content">
      <h2 className="mb-7 border-b-2 border-border-strong pb-2 font-heading text-mobile-heading-2 font-extrabold md:mb-12 md:text-heading-2">
        Похоже, это <em className="font-semibold text-terracotta">этот фильм</em>
      </h2>

      <div className="flex flex-col items-start gap-6 lg:flex-row lg:gap-8 lg:p-2.5">
        <div className="flex w-full flex-col gap-4 lg:w-[320px] lg:shrink-0 lg:gap-12">
          <div className="flex flex-col gap-2">
            <p className="font-label text-sm leading-[1.2] font-semibold tracking-widest text-muted uppercase">
              Твой кадр
            </p>
            {files[0] && <FilePreview file={files[0]} className="w-full" />}
          </div>

          <p className="text-sm leading-[1.5] text-muted">
            Не тот фильм? Попробуй другой кадр — лучше всего подходят кадры, где видны лица героев или узнаваемое место
          </p>
        </div>

        <div className="w-full min-w-0 flex-1">
          <MovieMatchCard movie={movie} />
        </div>
      </div>
    </div>
  );
};
