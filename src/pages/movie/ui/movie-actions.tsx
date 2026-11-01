import { useUnit } from "effector-react";
import { BookmarkPlus, Check, MessageSquare, Star } from "lucide-react";

import { $$session } from "@/entities/session";

import { Button } from "@/shared/ui";

export const MovieActions = () => {
  const { status, loginPressed } = useUnit({
    status: $$session.outputs.$status,
    loginPressed: $$session.inputs.loginPressed,
  });
  const disabled = status !== "guest";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-5 border-y border-divider py-4">
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
      <div className="flex flex-wrap gap-3">
        <Button variant="brand" isDisabled={disabled} onPress={() => loginPressed()}>
          <BookmarkPlus size={20} aria-hidden="true" /> Хочу посмотреть
        </Button>
        <Button variant="brand-secondary" isDisabled={disabled} onPress={() => loginPressed()}>
          <Check size={20} aria-hidden="true" /> Просмотрено
        </Button>
      </div>
      <p className="text-sm leading-relaxed text-muted">Оценки и списки скоро появятся.</p>
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
      className="flex flex-wrap items-center justify-between gap-5 border-t-2 border-border-strong pt-8"
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
