import { Link } from "@effector/router-react";
import { ArrowRight } from "lucide-react";

import { videoSearchTexts } from "@/features/search-by-video";

import { MoviePoster } from "@/entities/movie";

import { type MovieSearchResult } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import { routes } from "@/shared/routes";
import { buttonVariants } from "@/shared/ui/button";

import { VideoPreview } from "./video-preview";

export const VideoSearchResult = ({
  movie,
  file,
  durationSeconds,
}: {
  movie: MovieSearchResult;
  file: File | null;
  durationSeconds: number | null;
}) => (
  <div className="mx-auto max-w-content">
    <div className="border-b-2 border-border-strong pb-2">
      <h2 className="font-heading text-mobile-heading-2 font-bold md:text-heading-2 md:font-extrabold">
        {videoSearchTexts.resultTitle}{" "}
        <em className="font-semibold text-terracotta">{videoSearchTexts.resultAccent}</em>
      </h2>
    </div>

    <div className="mt-6 grid gap-6 md:mt-14 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:gap-x-8 md:px-5">
      {file && (
        <div className="hidden flex-col gap-3 md:col-start-1 md:row-start-1 md:flex">
          <p className="font-label text-sm leading-[1.2] font-semibold tracking-widest text-muted uppercase">
            {videoSearchTexts.fragment}
          </p>
          <VideoPreview file={file} durationSeconds={durationSeconds} size="large" />
        </div>
      )}

      <article className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-4 border-2 border-border-strong bg-card p-4 shadow-hard-lg md:col-start-2 md:row-span-2 md:row-start-1 md:grid-cols-[12.5rem_minmax(0,1fr)] md:grid-rows-[auto_auto_1fr] md:gap-x-8 md:p-6">
        <div className="md:row-span-3">
          <MoviePoster key={movie.poster_url} url={movie.poster_url} title={movie.title} />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="font-heading text-mobile-card-title font-bold break-words md:text-heading-3">{movie.title}</h3>
          {movie.year !== null && <p className="text-sm leading-[1.5] text-muted md:text-base">{movie.year}</p>}
        </div>

        {movie.overview && (
          <p className="col-span-2 text-base leading-[1.55] md:col-span-1 md:col-start-2">{movie.overview}</p>
        )}

        <Link
          className={cn(
            buttonVariants({ variant: "brand" }),
            "col-span-2 px-4 md:col-span-1 md:col-start-2 md:self-end md:justify-self-start md:px-6",
          )}
          to={routes.movie}
          params={{ movieId: String(movie.movie_id) }}
        >
          <ArrowRight size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
          {videoSearchTexts.openMovie}
        </Link>
      </article>

      <p className="text-center text-sm leading-[1.5] text-muted md:col-start-1 md:row-start-2 md:self-end md:text-left">
        {videoSearchTexts.resultHint}
      </p>
    </div>
  </div>
);
