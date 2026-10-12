import { LoaderCircle } from "lucide-react";

import { MovieCardSkeleton } from "@/entities/movie";

import { cn } from "@/shared/lib/cn";

import { type SearchMode } from "../config/search";

export const SearchLoading = ({ mode, message }: { mode: SearchMode; message: string }) => (
  <div>
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="mx-auto max-w-content border-b-2 border-border-strong pb-2"
    >
      <div className="flex items-center gap-[18px]">
        <LoaderCircle size={32} strokeWidth={1.75} className="shrink-0 motion-safe:animate-spin" aria-hidden="true" />
        <div>
          <h2 className="font-heading text-mobile-heading-3 font-bold md:text-heading-3">Ищем фильм…</h2>
          <p className="text-sm leading-[1.5] text-muted">
            {mode === "text" ? "Сравниваем описание со всеми фильмами каталога." : message}
          </p>
        </div>
      </div>
    </div>
    <div
      className={cn(
        "mx-auto mt-8 grid gap-x-3 gap-y-3.5 md:gap-6",
        mode === "text" ? "max-w-[792px] grid-cols-2 md:grid-cols-3" : "max-w-[248px] grid-cols-1",
      )}
    >
      {Array.from({ length: mode === "text" ? 3 : 1 }, (_, index) => (
        <MovieCardSkeleton key={index} />
      ))}
    </div>
  </div>
);
