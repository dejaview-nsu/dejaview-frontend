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
        <Button variant="brand-secondary" isDisabled={disabled} onPress={() => loginPressed()}>
          <MessageSquare size={20} aria-hidden="true" /> Написать отзыв
        </Button>
      </div>
      <p className="text-sm leading-relaxed text-muted">Оценки, списки и публикация отзывов скоро появятся.</p>
    </div>
  );
};
