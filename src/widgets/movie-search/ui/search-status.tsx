import { useUnit } from "effector-react";
import { CircleAlert, RefreshCcw, RefreshCw, TriangleAlert } from "lucide-react";

import { textSearchTexts } from "@/features/search-by-description";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { useMovieSearchModel } from "../model";
import { SearchEmpty } from "./search-empty";
import { SearchLoading } from "./search-loading";
import { SearchNotice } from "./search-notice";
import { TextSearchEmpty } from "./text-search-empty";

export const SearchStatus = () => {
  const $$model = useMovieSearchModel();
  const { mode, pending, progressMessage, error, isEmpty, image, search } = useUnit({
    mode: $$model.outputs.$mode,
    pending: $$model.outputs.$pending,
    progressMessage: $$model.outputs.$progressMessage,
    error: $$model.outputs.$error,
    isEmpty: $$model.outputs.$isEmpty,
    image: $$model.outputs.$image,
    search: $$model.inputs.searchPressed,
  });
  if (pending) return <SearchLoading mode={mode} message={progressMessage} />;
  if (mode === "image" && image.notice) {
    const { title, message, kind } = image.notice;
    const unavailable = kind === "unavailable";
    const Icon = unavailable ? TriangleAlert : CircleAlert;

    return (
      <div
        role="alert"
        className={cn(
          "mx-auto flex max-w-content flex-col gap-4 rounded-sm border-2 p-4 md:flex-row md:items-center md:gap-5 md:p-6",
          unavailable
            ? "border-warning-text bg-warning-bg text-warning-text"
            : "border-error-text bg-error-bg text-error-text",
        )}
      >
        <Icon className="shrink-0" size={28} strokeWidth={1.75} aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 md:p-2.5">
          <h2 className="font-heading text-mobile-heading-3 font-bold md:text-heading-3">{title}</h2>
          <p className="break-words text-base leading-[1.55]">{message}</p>
        </div>
        {kind !== "validation" && (
          <Button variant="brand-secondary" className="shrink-0" onPress={search}>
            <RefreshCcw size={20} strokeWidth={1.75} aria-hidden="true" />
            Повторить
          </Button>
        )}
      </div>
    );
  }
  if (mode === "text" && error)
    return (
      <SearchNotice
        tone="warning"
        title={textSearchTexts.unavailableTitle}
        message={error}
        actionLabel={textSearchTexts.retry}
        ActionIcon={RefreshCw}
        onAction={search}
      />
    );
  if (error)
    return (
      <div
        role="alert"
        className="mx-auto flex max-w-content items-start gap-3 border-2 border-error-text bg-error-bg p-4 text-error-text md:p-6"
      >
        <CircleAlert className="shrink-0" size={24} strokeWidth={1.75} aria-hidden="true" />
        <p className="min-w-0 break-words text-base leading-[1.55]">{error}</p>
      </div>
    );
  if (isEmpty) return mode === "text" ? <TextSearchEmpty onSearchAgain={search} /> : <SearchEmpty />;
  return null;
};
