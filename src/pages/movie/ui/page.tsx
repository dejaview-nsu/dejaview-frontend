import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { ArrowLeft, Film } from "lucide-react";

import { MoviePoster } from "@/entities/movie";

import { backOrHomeRequested, routes } from "@/shared/routes";
import { Button, buttonVariants, Panel } from "@/shared/ui";

import { $$movie } from "../model/page";
import { MovieReviewAction } from "./movie-actions";
import { MovieCast } from "./movie-cast";
import { MovieDetails } from "./movie-details";
import { MovieReviews } from "./movie-reviews";
import { MovieTrailer } from "./movie-trailer";

export const MoviePage = () => {
  const { movie, status, retryPressed, backPressed } = useUnit({
    movie: $$movie.outputs.$movie,
    status: $$movie.outputs.$status,
    retryPressed: $$movie.inputs.retryPressed,
    backPressed: backOrHomeRequested,
  });

  return (
    <div className="mx-auto flex w-full max-w-[calc(var(--container-content)+4rem)] flex-col gap-8 px-4 py-6 font-body text-ink md:gap-10 md:px-8 md:py-10">
      <Button
        variant="brand-ghost"
        onPress={() => backPressed()}
        className="self-start px-0 text-link hover:bg-transparent hover:underline"
      >
        <ArrowLeft size={20} aria-hidden="true" /> Назад
      </Button>

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
              <>
                <p className="text-muted">Проверьте ссылку или найдите другой фильм.</p>
                <Link to={routes.home} className={buttonVariants({ variant: "brand-secondary" })}>
                  Перейти к поиску
                </Link>
              </>
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
            <div className="mx-auto flex w-full max-w-[280px] flex-col gap-6 md:mx-0">
              <MoviePoster key={movie.poster_url} url={movie.poster_url} title={movie.title} variant="detail" />
              <MovieTrailer />
            </div>
            <MovieDetails movie={movie} />
          </div>

          <section
            aria-labelledby="movie-overview-title"
            className="flex flex-col gap-4 border-t-2 border-dashed border-divider pt-8"
          >
            <h2 id="movie-overview-title" className="font-heading text-mobile-heading-2 font-bold md:text-heading-2">
              Сюжет
            </h2>
            {movie.overview ? (
              <p className="max-w-search text-base leading-relaxed break-words whitespace-pre-wrap">{movie.overview}</p>
            ) : (
              <p className="text-base text-muted">Описание пока не добавлено</p>
            )}
          </section>

          <MovieCast actors={movie.actors} />
          <MovieReviewAction />
          <MovieReviews />
        </>
      )}
    </div>
  );
};
