import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { Bookmark, CircleAlert, Search } from "lucide-react";

import { ListMovieCard, ListMovieCardSkeleton } from "@/entities/movie";

import { type ListTypePath } from "@/shared/api";
import { routes } from "@/shared/routes";
import { Button, buttonVariants } from "@/shared/ui";

import { PROFILE_TEXTS } from "../config";
import { $$profileList } from "../model";
import { RemoveButton } from "./remove-button";

const gridStyle = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 md:gap-x-6 md:gap-y-8 lg:grid-cols-6";

const SKELETON_COUNT = 12;

const ListEmpty = ({ list }: { list: ListTypePath }) => (
  <div className="flex flex-col items-center gap-4 px-4 py-12 text-center md:py-16">
    <span className="flex size-16 items-center justify-center bg-header text-brand-gold" aria-hidden="true">
      <Bookmark size={28} strokeWidth={1.75} />
    </span>
    <h2 className="font-heading text-mobile-heading-2 font-bold">{PROFILE_TEXTS.emptyTitle}</h2>
    <p className="max-w-search text-base leading-normal text-muted">{PROFILE_TEXTS.emptyHint[list]}</p>
    <Link to={routes.home} query={{}} className={buttonVariants({ variant: "brand" })}>
      <Search size={20} strokeWidth={1.75} aria-hidden="true" />
      {PROFILE_TEXTS.findMovie}
    </Link>
  </div>
);

export const ListContent = ({ list }: { list: ListTypePath }) => {
  const { movies, status, retryPressed } = useUnit({
    movies: $$profileList.outputs.$movies,
    status: $$profileList.outputs.$status,
    retryPressed: $$profileList.inputs.retryPressed,
  });

  if (status === "failed")
    return (
      <div role="alert" className="flex flex-col items-center gap-5 px-4 py-12 text-center md:py-16">
        <CircleAlert size={48} className="text-muted" aria-hidden="true" />
        <p className="font-heading text-mobile-heading-3 font-bold md:text-heading-3">{PROFILE_TEXTS.listFailed}</p>
        <Button variant="brand" aria-label={PROFILE_TEXTS.retryList} onPress={() => retryPressed()}>
          {PROFILE_TEXTS.retry}
        </Button>
      </div>
    );

  if (status === "ready" && movies.length === 0) return <ListEmpty list={list} />;

  if (status === "ready")
    return (
      <ul className={gridStyle}>
        {movies.map((movie) => (
          <li key={movie.movie_id} className="min-w-0">
            <ListMovieCard movie={movie} action={<RemoveButton list={list} movie={movie} />} />
          </li>
        ))}
      </ul>
    );

  return (
    <div role="status" aria-label={PROFILE_TEXTS.loadingList} className={gridStyle}>
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <ListMovieCardSkeleton key={index} />
      ))}
      <span className="sr-only">{PROFILE_TEXTS.loadingList}…</span>
    </div>
  );
};
