import { useUnit } from "effector-react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import { $$session } from "@/entities/session";

import { type MovieReview } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui";

import { reactionScore, reviewDate } from "../lib/format";

const VERDICTS = {
  positive: { text: "Положительно", className: "bg-success-bg text-success-text" },
  neutral: { text: "Нейтрально", className: "bg-warning-bg text-warning-text" },
  negative: { text: "Негативно", className: "bg-error-bg text-error-text" },
};

export const ReviewCard = ({ review }: { review: MovieReview }) => {
  const { status, loginPressed } = useUnit({
    status: $$session.outputs.$status,
    loginPressed: $$session.inputs.loginPressed,
  });
  const verdict = VERDICTS[review.verdict];

  return (
    <article className="flex min-w-0 flex-col gap-4 border-2 border-border-strong bg-card p-4 shadow-hard md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-bold break-words">{review.username ?? "Удалённый пользователь"}</p>
          <p className="text-xs leading-relaxed text-muted md:text-sm">
            <time dateTime={review.created_at}>{reviewDate(review.created_at)}</time>
            {review.is_edited && " · Редактирован"}
          </p>
        </div>
        <span className={cn("px-3 py-1 text-sm font-semibold", verdict.className)}>{verdict.text}</span>
      </div>
      {review.title && (
        <h3 className="font-heading text-mobile-heading-3 font-bold break-words md:text-heading-3">{review.title}</h3>
      )}
      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap md:text-base">{review.body}</p>
      <div className="flex flex-wrap items-center gap-3 border-t-2 border-dashed border-divider pt-3">
        <span className="text-sm text-muted">Полезный отзыв?</span>
        <Button
          variant="brand-ghost"
          isDisabled={status !== "guest"}
          onPress={() => loginPressed()}
          aria-label={`Полезный отзыв, положительных реакций: ${review.likes}`}
        >
          <ThumbsUp size={18} aria-hidden="true" /> {review.likes}
        </Button>
        <span className="font-label text-lg" aria-label={`Сумма реакций: ${reactionScore(review)}`}>
          {reactionScore(review)}
        </span>
        <Button
          variant="brand-ghost"
          isDisabled={status !== "guest"}
          onPress={() => loginPressed()}
          aria-label={`Неполезный отзыв, отрицательных реакций: ${review.dislikes}`}
        >
          <ThumbsDown size={18} aria-hidden="true" /> {review.dislikes}
        </Button>
      </div>
    </article>
  );
};
