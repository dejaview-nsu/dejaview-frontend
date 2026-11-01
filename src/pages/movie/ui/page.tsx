import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { ArrowLeft, Film } from "lucide-react";

import { MoviePoster } from "@/entities/movie";

import { routes } from "@/shared/routes";
import { Button, Panel } from "@/shared/ui";

import { $$movie } from "../model/page";
import { MovieCast } from "./movie-cast";
import { MovieDetails } from "./movie-details";
import { MovieReviews } from "./movie-reviews";

export const MoviePage = () => {
  const { movie, status, retryPressed } = useUnit({
    movie: $$movie.outputs.$movie,
    status: $$movie.outputs.$status,
    retryPressed: $$movie.inputs.retryPressed,
  });

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-6 font-body text-ink md:gap-10 md:px-8 md:py-10">
      <Link
        to={routes.home}
        className="inline-flex min-h-11 items-center gap-2 self-start font-label text-sm font-semibold tracking-widest text-link uppercase outline-link hover:underline focus-visible:outline-2"
      >
        <ArrowLeft size={20} aria-hidden="true" /> Вернуться к поиску
      </Link>

      {(status === "idle" || status === "loading") && (
        <div
          role="status"
          aria-label="Загружаем информацию о фильме"
          className="grid animate-pulse gap-8 motion-reduce:animate-none md:grid-cols-[280px_minmax(0,1fr)]"
        >
          <div className="mx-auto aspect-[2/3] w-full max-w-[280px] bg-disabled-bg" />
          <div className="flex flex-col gap-6">
            <div className="h-12 w-3/4 bg-disabled-bg" />
            <div className="h-6 w-1/2 bg-disabled-bg" />
            <div className="h-48 bg-disabled-bg" />
            <span className="sr-only">Загружаем информацию о фильме…</span>
          </div>
        </div>
      )}

      {(status === "not-found" || status === "failed") && (
        <Panel>
          <div className="flex flex-col items-center gap-5 py-8 text-center" role="alert">
            <Film size={48} className="text-muted" aria-hidden="true" />
            <h1 className="font-heading text-mobile-heading-2 font-bold md:text-heading-2">
              {status === "not-found"
                ? "Фильм не найден"
                : "Не удалось загрузить информацию о фильме. Попробуйте позже"}
            </h1>
            {status === "not-found" ? (
              <p className="text-muted">Проверьте ссылку или найдите другой фильм.</p>
            ) : (
              <Button variant="brand" onPress={() => retryPressed()}>
                Повторить
              </Button>
            )}
          </div>
        </Panel>
      )}

      {status === "ready" && movie && (
        <>
          <div className="grid items-start gap-8 md:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
            <div className="mx-auto w-full max-w-[280px] md:mx-0">
              <MoviePoster key={movie.poster_url} url={movie.poster_url} title={movie.title} variant="detail" />
            </div>
            <MovieDetails movie={movie} />
          </div>

          {movie.overview && (
            <section
              aria-labelledby="movie-overview-title"
              className="flex flex-col gap-4 border-t-2 border-border-strong pt-8"
            >
              <h2 id="movie-overview-title" className="font-heading text-mobile-heading-2 font-bold md:text-heading-2">
                Сюжет
              </h2>
              <p className="max-w-search text-base leading-relaxed break-words whitespace-pre-wrap">{movie.overview}</p>
            </section>
          )}

          {movie.actors.length > 0 && <MovieCast actors={movie.actors} />}
          <MovieReviews />
        </>
      )}
    </div>
  );
};
