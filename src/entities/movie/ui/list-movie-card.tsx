import { Link } from "@effector/router-react";
import { Star } from "lucide-react";
import { type ReactNode } from "react";

import { type UserListMovie } from "@/shared/api";
import { formatRating } from "@/shared/lib/format";
import { routes } from "@/shared/routes";

import { MoviePoster } from "./movie-poster";

const RatingRow = ({ label, value }: { label: string; value: number | null }) => (
  <p className="flex items-center justify-between gap-2 text-[13px] leading-[1.4] text-muted">
    <span className="min-w-0 truncate">
      {label}: <span className="text-ink">{formatRating(value)}</span>
    </span>
    <Star size={16} strokeWidth={1.75} className="shrink-0 text-brand-gold" aria-hidden="true" />
  </p>
);

export const ListMovieCard = ({ movie, action }: { movie: UserListMovie; action?: ReactNode }) => {
  const params = { movieId: String(movie.movie_id) };

  return (
    <article className="flex h-full min-w-0 flex-col gap-2">
      <Link to={routes.movie} params={params} query={{}} tabIndex={-1} aria-hidden="true" className="block">
        <MoviePoster key={movie.poster_url} url={movie.poster_url} title={movie.title} variant="tile" />
      </Link>

      <h3 className="min-w-0 font-heading text-base leading-[1.25] font-bold md:text-lg">
        <Link
          to={routes.movie}
          params={params}
          query={{}}
          title={movie.title}
          className="block truncate outline-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {movie.title}
        </Link>
      </h3>

      <div className="flex flex-col gap-1">
        <RatingRow label="Общая оценка" value={movie.average_rating} />
        <RatingRow label="Ваша оценка" value={movie.user_rating} />
      </div>

      {action && <div className="mt-auto pt-1">{action}</div>}
    </article>
  );
};
