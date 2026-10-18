import { Link } from "@effector/router-react";
import { ArrowRight } from "lucide-react";

import { type MovieSearchResult } from "@/shared/api";
import { routes } from "@/shared/routes";

import { MoviePoster } from "./movie-poster";

export const MovieMatchCard = ({ movie }: { movie: MovieSearchResult }) => (
  <article className="flex min-w-0 flex-col gap-6 border-2 border-border-strong bg-card p-4 shadow-hard-lg sm:flex-row md:p-6">
    <div className="mx-auto w-[160px] shrink-0 sm:mx-0 md:w-[200px]">
      <MoviePoster key={movie.poster_url} url={movie.poster_url} title={movie.title} />
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-6 md:gap-12 md:p-2.5">
      <div className="flex flex-col gap-4">
        <h3 className="break-words font-heading text-mobile-heading-2 font-extrabold md:text-heading-2">
          {movie.title}
        </h3>
        <p className="text-base leading-[1.55] text-muted">{movie.year ?? "Год выпуска неизвестен"}</p>
        <p className="line-clamp-6 break-words text-base leading-[1.55]">
          {movie.overview || "Описание фильма пока недоступно."}
        </p>
      </div>

      <Link
        className="mt-auto inline-flex min-h-12 items-center justify-center gap-2.5 border-2 border-border-strong bg-brand-brown px-3 py-3 text-center font-label text-[15px]/[1.2] font-semibold tracking-widest text-brand-gold uppercase shadow-hard outline-link hover:bg-button-hover focus-visible:outline-2 md:self-start md:px-6"
        to={routes.movie}
        params={{ movieId: String(movie.movie_id) }}
        aria-label={`Открыть карточку фильма «${movie.title}»`}
      >
        <ArrowRight size={24} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
        Открыть карточку фильма
      </Link>
    </div>
  </article>
);
