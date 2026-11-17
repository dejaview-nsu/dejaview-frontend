import { useUnit } from "effector-react";
import { Check, MessageSquare, Star } from "lucide-react";

import { $$session } from "@/entities/session";

import { cn } from "@/shared/lib/cn";
import { Button, buttonVariants } from "@/shared/ui";

import { $$movieLists } from "../model/page";

const movieLists = [
  { list: "want_to_watch", label: "Хочу посмотреть" },
  { list: "watched", label: "Просмотрено" },
] as const;

export const MovieActions = () => {
  const { status, loginPressed, lists, togglePressed, retryPressed } = useUnit({
    status: $$session.outputs.$status,
    loginPressed: $$session.inputs.loginPressed,
    lists: $$movieLists.outputs.$state,
    togglePressed: $$movieLists.inputs.togglePressed,
    retryPressed: $$movieLists.inputs.retryPressed,
  });
  const disabled = status !== "guest";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-5 border-y-2 border-dashed border-divider py-4">
        <div className="flex items-center gap-3">
          <Star className="text-brand-gold" size={28} aria-hidden="true" />
          <span className="font-heading text-heading-2 font-bold" aria-label="Оценок пока нет">
            —
          </span>
          <span className="text-sm text-muted">Оценка DejaView</span>
        </div>
        <Button variant="brand-secondary-small" isDisabled={disabled} onPress={() => loginPressed()}>
          <Star size={18} aria-hidden="true" /> Оценить
        </Button>
      </div>

      <fieldset
        aria-label="Мои списки"
        aria-busy={lists.pending || lists.status === "loading"}
        disabled={!lists.canToggle}
        className="flex flex-wrap gap-3 transition-opacity duration-150 disabled:opacity-50 motion-reduce:transition-none"
      >
        {movieLists.map(({ list, label }) => (
          <label
            key={list}
            className={cn(
              buttonVariants({ variant: "brand-secondary" }),
              "has-disabled:pointer-events-none has-disabled:cursor-default has-focus-visible:ring-2 has-focus-visible:ring-link has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-card",
            )}
          >
            <input
              type="checkbox"
              checked={lists.membership?.[list] ?? false}
              onChange={() => togglePressed(list)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                "flex size-5 shrink-0 items-center justify-center border-2 border-border-strong",
                lists.membership?.[list] && "bg-brand-brown text-brand-gold",
              )}
            >
              {lists.membership?.[list] && <Check size={16} strokeWidth={3} />}
            </span>
            {label}
          </label>
        ))}
      </fieldset>

      {lists.error && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-error-text">
            {lists.error}
          </p>
          <Button
            variant="brand-link"
            aria-label="Повторить действие со списками"
            isDisabled={lists.pending || lists.status === "loading"}
            onPress={() => retryPressed()}
          >
            Повторить
          </Button>
        </div>
      )}

      <p className="text-sm leading-relaxed text-muted">Оценки скоро появятся.</p>
    </div>
  );
};

export const MovieReviewAction = () => {
  const { status, loginPressed } = useUnit({
    status: $$session.outputs.$status,
    loginPressed: $$session.inputs.loginPressed,
  });

  return (
    <section
      aria-labelledby="movie-own-review-title"
      className="flex flex-wrap items-center justify-between gap-5 border-t-2 border-dashed border-divider pt-8"
    >
      <div className="flex flex-col gap-3">
        <h2 id="movie-own-review-title" className="font-heading text-mobile-heading-2 font-bold md:text-heading-2">
          Ваш отзыв
        </h2>
        <p className="text-sm leading-relaxed text-muted">Возможность написать отзыв скоро появится.</p>
      </div>
      <Button variant="brand-secondary" isDisabled={status !== "guest"} onPress={() => loginPressed()}>
        <MessageSquare size={20} aria-hidden="true" /> Написать отзыв
      </Button>
    </section>
  );
};
