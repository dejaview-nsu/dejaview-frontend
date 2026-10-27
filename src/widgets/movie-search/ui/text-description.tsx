import { useUnit } from "effector-react";
import { CircleAlert, X } from "lucide-react";
import { type ChangeEvent } from "react";
import { Button } from "react-aria-components";

import { QUERY_MAX_LENGTH, queryErrorMessages, textSearchTexts } from "@/features/search-by-description";

import { cn } from "@/shared/lib/cn";

import { useMovieSearchModel } from "../model";

export const TEXT_DESCRIPTION_ID = "film-description";

const HINT_ID = `${TEXT_DESCRIPTION_ID}-hint`;

const ERROR_ID = `${TEXT_DESCRIPTION_ID}-error`;

const PASTE_INPUT_TYPES = ["insertFromPaste", "insertFromPasteAsQuotation", "insertFromDrop"];

const isPasted = (event: ChangeEvent<HTMLTextAreaElement>) => {
  const { inputType } = event.nativeEvent as InputEvent;

  return typeof inputType === "string" && PASTE_INPUT_TYPES.includes(inputType);
};

export const TextDescription = () => {
  const $$model = useMovieSearchModel();
  const { text, length, overLimit, fieldError, pending, changeText } = useUnit({
    text: $$model.outputs.$text,
    length: $$model.outputs.$textLength,
    overLimit: $$model.outputs.$textOverLimit,
    fieldError: $$model.outputs.$textFieldError,
    pending: $$model.outputs.$pending,
    changeText: $$model.inputs.textChanged,
  });
  const invalid = fieldError !== null;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={TEXT_DESCRIPTION_ID} className="text-base leading-[1.55] font-semibold">
        {textSearchTexts.label}
      </label>

      <div className="relative">
        <textarea
          id={TEXT_DESCRIPTION_ID}
          className={cn(
            "block h-[120px] w-full resize-none border-[1.5px] bg-input px-4 pt-3 pb-11 text-base leading-[1.55] text-ink outline-link placeholder:text-muted disabled:cursor-wait",
            invalid ? "border-error-text" : "border-border-default",
          )}
          value={text}
          disabled={pending}
          onChange={(event) => changeText({ text: event.currentTarget.value, pasted: isPasted(event) })}
          placeholder={textSearchTexts.placeholder}
          aria-invalid={invalid}
          aria-describedby={invalid ? ERROR_ID : HINT_ID}
        />

        {text && (
          <Button
            aria-label="Очистить описание"
            isDisabled={pending}
            onPress={() => changeText({ text: "" })}
            className="absolute bottom-0 left-4 flex min-h-11 cursor-pointer items-center gap-2 text-sm leading-[1.5] text-muted outline-link hover:text-ink focus-visible:outline-2 disabled:cursor-wait disabled:opacity-50"
          >
            <X size={12} strokeWidth={1.75} aria-hidden="true" /> {textSearchTexts.clear}
          </Button>
        )}

        <span
          className={cn(
            "pointer-events-none absolute right-3 bottom-3 text-sm leading-[1.5]",
            overLimit ? "font-semibold text-error-text" : "text-muted",
          )}
          aria-hidden="true"
        >
          {length}/{QUERY_MAX_LENGTH}
        </span>
      </div>

      {invalid ? (
        <p id={ERROR_ID} role="alert" className="flex items-start gap-2 text-sm leading-[1.5] text-error-text">
          <CircleAlert className="mt-px shrink-0" size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="min-w-0 break-words">{queryErrorMessages[fieldError]}</span>
        </p>
      ) : (
        <p id={HINT_ID} className="text-sm leading-[1.5] text-muted">
          {textSearchTexts.hint}
        </p>
      )}
    </div>
  );
};
