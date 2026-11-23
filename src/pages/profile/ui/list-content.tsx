import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { Bookmark, CircleAlert, Search, SearchX } from "lucide-react";
import { useRef } from "react";

import { ListMovieCard, ListMovieCardSkeleton } from "@/entities/movie";

import { type ListTypePath } from "@/shared/api";
import { routes } from "@/shared/routes";
import { Button, buttonVariants } from "@/shared/ui";

import { PROFILE_TEXTS } from "../config";
import { $$profileLists } from "../model";
import { ListPagination } from "./list-pagination";
import { ListToolbar } from "./list-toolbar";
import { RemoveButton } from "./remove-button";

const gridStyle = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 md:gap-x-6 md:gap-y-8 lg:grid-cols-6";

const SKELETON_COUNT = 12;

const ListEmpty = ({ list }: { list: ListTypePath }) => (
  <div className="flex flex-col items-center gap-4 px-4 pt-14 pb-12 text-center md:pt-18 md:pb-16">
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

const SearchEmpty = ({ query }: { query: string }) => (
  <div role="status" className="flex flex-col items-center gap-4 px-4 py-12 text-center md:py-16">
    <span className="flex size-16 items-center justify-center bg-header text-brand-gold" aria-hidden="true">
      <SearchX size={28} strokeWidth={1.75} />
    </span>
    <h2 className="font-heading text-mobile-heading-2 font-bold">Ничего не найдено</h2>
    <p className="max-w-xl wrap-anywhere text-base leading-normal text-muted">
      По запросу «{query}» в этом списке нет фильмов. Проверь написание или нажми «Очистить», чтобы увидеть весь список.
    </p>
  </div>
);

const ListResults = ({ list }: { list: ListTypePath }) => {
  const model = $$profileLists[list];
  const { movies, status, refreshFailed, retryPressed, query, fullTotal } = useUnit({
    movies: model.outputs.$movies,
    status: model.outputs.$status,
    refreshFailed: model.outputs.$refreshFailed,
    retryPressed: model.inputs.retryPressed,
    query: model.outputs.$query,
    fullTotal: model.outputs.$fullTotal,
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

  if (status === "ready" && movies.length === 0) {
    return query?.q && fullTotal !== 0 ? <SearchEmpty query={query.q} /> : <ListEmpty list={list} />;
  }

  if (status === "ready")
    return (
      <>
        {refreshFailed && (
          <div className="mb-4 flex flex-wrap items-center gap-x-4 border-b border-divider text-sm">
            <p role="status" className="text-muted">
              {PROFILE_TEXTS.refreshListFailed}
            </p>
            <Button variant="brand-link" aria-label={PROFILE_TEXTS.retryList} onPress={() => retryPressed()}>
              {PROFILE_TEXTS.retry}
            </Button>
          </div>
        )}
        <ul className={gridStyle}>
          {movies.map((movie) => (
            <li key={movie.movie_id} className="min-w-0">
              <ListMovieCard movie={movie} action={<RemoveButton list={list} movie={movie} />} />
            </li>
          ))}
        </ul>
      </>
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

export const ListContent = ({ list }: { list: ListTypePath }) => {
  const model = $$profileLists[list];
  const { query, pages, status, fullTotal, selectPage } = useUnit({
    query: model.outputs.$query,
    pages: model.outputs.$pageCount,
    status: model.outputs.$status,
    fullTotal: model.outputs.$fullTotal,
    selectPage: model.inputs.pageSelected,
  });
  const start = useRef<HTMLDivElement>(null);
  const isEmpty = status === "ready" && fullTotal === 0;

  return (
    <div ref={start} className="scroll-mt-4" aria-busy={status === "loading"}>
      {query && !isEmpty && <ListToolbar model={model} sort={query.sort} />}
      <ListResults list={list} />

      {query && pages > 0 && (
        <ListPagination
          page={Math.min(query.page, pages)}
          total={pages}
          onSelect={(page) => {
            if (page === query.page || page < 1 || page > pages) return;

            selectPage(page);
            start.current?.scrollIntoView?.({ block: "start" });
          }}
        />
      )}
    </div>
  );
};
