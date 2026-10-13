import { useUnit } from "effector-react";
import { CircleAlert } from "lucide-react";

import { useMovieSearchModel } from "../model";
import { SearchEmpty } from "./search-empty";
import { SearchLoading } from "./search-loading";

export const SearchStatus = () => {
  const $$model = useMovieSearchModel();
  const { mode, pending, progressMessage, error, isEmpty } = useUnit({
    mode: $$model.outputs.$mode,
    pending: $$model.outputs.$pending,
    progressMessage: $$model.outputs.$progressMessage,
    error: $$model.outputs.$error,
    isEmpty: $$model.outputs.$isEmpty,
  });
  if (pending) return <SearchLoading mode={mode} message={progressMessage} />;
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
  if (isEmpty) return <SearchEmpty mode={mode} />;
  return null;
};
