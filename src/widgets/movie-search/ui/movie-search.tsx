import { useUnit } from "effector-react";

import { cn } from "@/shared/lib/cn";

import { movieSearchModelView, useMovieSearchModel } from "../model";
import { MovieSearchForm } from "./search-form";

export const MovieSearch = movieSearchModelView(() => {
  const $$model = useMovieSearchModel();
  const { mode, authenticated } = useUnit({
    mode: $$model.outputs.$mode,
    authenticated: $$model.outputs.$isAuthenticated,
  });

  return (
    <section
      className={cn(
        "relative mx-auto -mt-16 w-full max-w-search border-2 border-border-strong bg-card p-3.5 shadow-hard-lg md:-mt-[150px] md:min-h-0 md:p-7 md:shadow-hard-xl",
        mode === "text" && (authenticated ? "min-h-[642px]" : "min-h-[730px]"),
      )}
      aria-label="Поиск фильма"
    >
      <MovieSearchForm />
    </section>
  );
});
