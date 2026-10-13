import { useUnit } from "effector-react";

import { MovieCard } from "@/entities/movie";

import { movieSearchModelView, useMovieSearchModel } from "../model";
import { SearchStatus } from "./search-status";
import { VideoSearchOutput } from "./video-search-output";

const pluralRules = new Intl.PluralRules("ru");

const ResultsView = ({ fileInputId }: { fileInputId: string }) => {
  const $$model = useMovieSearchModel();
  const { results, pending, error, isEmpty, mode, submittedQuery, hasSearchOutput } = useUnit({
    results: $$model.outputs.$results,
    pending: $$model.outputs.$pending,
    error: $$model.outputs.$error,
    isEmpty: $$model.outputs.$isEmpty,
    mode: $$model.outputs.$mode,
    submittedQuery: $$model.outputs.$submittedQuery,
    hasSearchOutput: $$model.outputs.$hasSearchOutput,
  });
  const count = results?.length ?? 0;
  const plural = pluralRules.select(count);
  const countLabel = `${plural === "one" ? "Найден" : "Найдено"} ${count} ${plural === "one" ? "фильм" : plural === "few" ? "фильма" : "фильмов"}`;
  if (!hasSearchOutput) return null;
  return (
    <section aria-label="Результаты поиска" aria-busy={pending} className="mx-auto mt-12 w-full max-w-results md:mt-16">
      {mode === "video" ? (
        <VideoSearchOutput fileInputId={fileInputId} />
      ) : pending || error || isEmpty ? (
        <SearchStatus />
      ) : (
        <>
          <div className="mx-auto mb-7 max-w-content border-b-2 border-border-strong pb-6 md:mb-12">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-6">
              <h2 className="min-w-0 font-heading text-mobile-heading-3 font-bold md:text-heading-2 md:font-extrabold">
                {mode === "text" ? "Результаты по запросу:" : "Результат поиска"}
                {mode === "text" && (
                  <em className="block break-words font-semibold text-terracotta">«{submittedQuery}»</em>
                )}
              </h2>
              <p className="shrink-0 text-sm leading-[1.5] text-muted">{countLabel}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 items-stretch gap-x-3 gap-y-3.5 md:grid-cols-3 md:gap-6 lg:grid-cols-4 desktop:grid-cols-5">
            {results?.map((movie) => (
              <MovieCard key={movie.movie_id} movie={movie} />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export const MovieSearchResults = movieSearchModelView(ResultsView);
