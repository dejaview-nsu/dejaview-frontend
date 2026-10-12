import { Link } from "@effector/router-react";

import { type MovieSearchResult } from "@/shared/api";
import { routes } from "@/shared/routes";

import { MoviePoster } from "./movie-poster";

export const MovieCard = ({ movie }: { movie: MovieSearchResult }) => (
  <article className="flex h-full min-w-0 flex-col gap-1.5 border-2 border-border-strong bg-card p-2 shadow-hard md:gap-3 md:p-4 md:shadow-hard-lg">
    <MoviePoster key={movie.poster_url} url={movie.poster_url} title={movie.title} />
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <h3 className="truncate font-heading text-mobile-card-title font-bold md:text-card-title" title={movie.title}>
        {movie.title}
      </h3>

      {movie.year !== null && <p className="text-sm leading-[1.5] text-muted">{movie.year}</p>}
      {movie.overview && (
        <p className="line-clamp-2 text-sm md:line-clamp-3 leading-[1.5] text-ink">{movie.overview}</p>
      )}

      <Link
        className="mt-auto flex min-h-11 items-center font-label text-sm leading-[1.2] font-semibold tracking-widest text-link uppercase outline-link hover:underline"
        to={routes.movie}
        params={{ movieId: String(movie.movie_id) }}
        aria-label={`Подробнее о фильме «${movie.title}»`}
      >
        Подробнее
      </Link>
    </div>
  </article>
);
