import { type MovieCard } from "@/shared/api";

import { movieFacts } from "../lib/format";
import { MovieActions } from "./movie-actions";

export const MovieDetails = ({ movie }: { movie: MovieCard }) => {
  const facts = movieFacts(movie);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="font-label text-sm tracking-widest text-muted uppercase">Карточка фильма</p>
        <h1 className="font-heading text-mobile-heading-1 font-extrabold break-words md:text-heading-1">
          {movie.title}
        </h1>
        <p className="text-lg text-muted break-words">{movie.original_title}</p>
        {(movie.year !== null || movie.age_rating !== null) && (
          <div className="flex items-center gap-3 text-base text-muted">
            {movie.year !== null && <span>{movie.year}</span>}
            {movie.age_rating !== null && (
              <span className="border border-border-default px-2 py-0.5 text-sm">{movie.age_rating}</span>
            )}
          </div>
        )}
      </div>

      <MovieActions />

      {facts.length > 0 && (
        <section aria-labelledby="movie-facts-title" className="flex flex-col gap-4">
          <h2 id="movie-facts-title" className="font-heading text-mobile-heading-3 font-bold md:text-heading-3">
            О фильме
          </h2>
          <dl className="flex flex-col gap-3 text-sm leading-relaxed md:text-base">
            {facts.map(({ label, value }) => (
              <div
                key={label}
                className="grid grid-cols-[minmax(0,100px)_minmax(0,1fr)] gap-4 md:grid-cols-[140px_minmax(0,1fr)]"
              >
                <dt className="text-muted">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
};
