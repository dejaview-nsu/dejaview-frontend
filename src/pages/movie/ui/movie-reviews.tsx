import { useUnit } from "effector-react";

import { Button } from "@/shared/ui";

import { type ReviewSort } from "../api/request";
import { $$movie } from "../model/page";
import { ReviewCard } from "./review-card";

const SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: "best", label: "Сначала лучшие" },
  { value: "worst", label: "Сначала худшие" },
  { value: "newest", label: "Самые новые" },
  { value: "oldest", label: "Самые старые" },
];

export const MovieReviews = () => {
  const { reviews, hasMore, pending, error, sort, sortChanged, morePressed, retryPressed } = useUnit({
    reviews: $$movie.$$reviews.outputs.$reviews,
    hasMore: $$movie.$$reviews.outputs.$hasMore,
    pending: $$movie.$$reviews.outputs.$pending,
    error: $$movie.$$reviews.outputs.$error,
    sort: $$movie.$$reviews.outputs.$sort,
    sortChanged: $$movie.$$reviews.inputs.sortChanged,
    morePressed: $$movie.$$reviews.inputs.morePressed,
    retryPressed: $$movie.$$reviews.inputs.retryPressed,
  });

  return (
    <section aria-labelledby="movie-reviews-title" className="flex flex-col gap-6 border-t-2 border-border-strong pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="movie-reviews-title" className="font-heading text-mobile-heading-2 font-bold md:text-heading-2">
          Отзывы
        </h2>
        <label className="flex w-full flex-wrap items-center gap-3 text-sm text-muted sm:w-auto">
          Сортировать по:
          <select
            className="min-h-11 w-full border-2 border-border-strong bg-card px-3 py-2 font-body text-ink outline-link focus-visible:outline-2 sm:w-auto"
            value={sort}
            onChange={(event) => sortChanged(event.target.value as ReviewSort)}
          >
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div aria-busy={pending} className="flex flex-col gap-5">
        {reviews.map((review) => (
          <ReviewCard key={review.review_id} review={review} />
        ))}
        {pending && (
          <p role="status" className="py-6 text-center text-muted">
            Загружаем отзывы…
          </p>
        )}
        {!pending && !error && reviews.length === 0 && (
          <p className="border border-divider bg-card p-6 text-center text-muted">Отзывов пока нет.</p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-4 border border-warning-text bg-warning-bg p-4 text-warning-text"
        >
          <p>Не удалось загрузить отзывы. Попробуйте ещё раз.</p>
          <Button variant="brand-secondary-small" onPress={() => retryPressed()}>
            Повторить загрузку отзывов
          </Button>
        </div>
      )}
      {hasMore && !error && (
        <Button
          variant="brand-secondary"
          className="w-full sm:self-center sm:w-auto"
          isDisabled={pending}
          onPress={() => morePressed()}
        >
          Ещё отзывы
        </Button>
      )}
    </section>
  );
};
