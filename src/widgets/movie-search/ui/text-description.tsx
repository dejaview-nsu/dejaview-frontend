import { useUnit } from "effector-react";
import { X } from "lucide-react";
import { Button } from "react-aria-components";

import { useMovieSearchModel } from "../model";

export const TextDescription = () => {
  const $$model = useMovieSearchModel();
  const { text, pending, changeText } = useUnit({
    text: $$model.outputs.$text,
    pending: $$model.outputs.$pending,
    changeText: $$model.inputs.textChanged,
  });

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="film-description" className="text-base leading-[1.55] font-semibold">
        Опиши, что помнишь о фильме
      </label>
      <div className="relative">
        <textarea
          id="film-description"
          className="block h-[120px] w-full resize-none border-[1.5px] border-border-default bg-input px-4 pt-3 pb-11 text-base leading-[1.55] text-ink outline-link placeholder:text-muted disabled:cursor-wait"
          value={text}
          disabled={pending}
          onChange={(event) => changeText(event.currentTarget.value)}
          placeholder="Например: солдат в окопе, за кадром играет скрипка"
          aria-describedby="film-description-hint"
        />
        {text && (
          <Button
            aria-label="Очистить описание"
            isDisabled={pending}
            onPress={() => changeText("")}
            className="absolute bottom-0 left-4 flex min-h-11 cursor-pointer items-center gap-2 text-sm leading-[1.5] text-muted outline-link hover:text-ink disabled:cursor-wait disabled:opacity-50"
          >
            <X size={12} strokeWidth={1.75} aria-hidden="true" /> Очистить
          </Button>
        )}
        <span
          className="pointer-events-none absolute right-3 bottom-3 text-sm leading-[1.5] text-muted"
          aria-hidden="true"
        >
          {[...text].length}/250
        </span>
      </div>
      <p id="film-description-hint" className="text-sm leading-[1.5] text-muted">
        Сюжет, сцена, персонажи, реплики, жанр или примерный год.
      </p>
    </div>
  );
};
