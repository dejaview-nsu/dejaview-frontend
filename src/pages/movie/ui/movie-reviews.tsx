import { useUnit } from "effector-react";

import { Button, Select } from "@/shared/ui";

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
    <section
      aria-labelledby="movie-reviews-title"
      className="flex flex-col gap-6 border-t-2 border-dashed border-divider pt-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="movie-reviews-title" className="font-heading text-mobile-heading-2 font-bold md:text-heading-2">
          Отзывы
        </h2>
        {(reviews.length > 0 || pending || error) && (
          <Select label="Сортировать по:" value={sort} options={SORT_OPTIONS} onChange={sortChanged} />
        )}
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
          <p className="text-base text-muted">Пока никто не оставил отзыв</p>
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
