import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { type InputHTMLAttributes, type ReactNode, type Ref, useState } from "react";
import { Button } from "react-aria-components";

import { cn } from "../../lib/cn";

export type FieldError = { message: string | null };

export const PASSWORD_TOGGLE_LABELS = { show: "Показать пароль", hide: "Скрыть пароль" } as const;

export const FormField = ({
  id,
  label,
  error,
  hint,
  keepHint = false,
  revealable = false,
  inputRef,
  className,
  type,
  ...inputProps
}: {
  id: string;
  label: string;
  error: FieldError | null;
  hint?: ReactNode;
  keepHint?: boolean;
  revealable?: boolean;
  inputRef: Ref<HTMLInputElement>;
} & InputHTMLAttributes<HTMLInputElement>) => {
  const [revealed, setRevealed] = useState(false);

  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const showHint = Boolean(hint) && (keepHint || !error?.message);
  const describedBy =
    [error?.message ? errorId : null, showHint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base leading-normal font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type={revealable && revealed ? "text" : type}
          aria-invalid={error !== null}
          aria-describedby={describedBy}
          className={cn(
            "h-12 w-full scroll-mt-16 border-2 border-border-default bg-input px-4 text-base text-ink outline-link placeholder:text-muted focus:border-border-strong focus:shadow-hard focus-visible:outline-2 focus-visible:outline-offset-2",
            revealable && "pr-14",
            error !== null && "border-error-text focus:border-error-text",
            className,
          )}
          {...inputProps}
        />
        {revealable && (
          <Button
            aria-label={revealed ? PASSWORD_TOGGLE_LABELS.hide : PASSWORD_TOGGLE_LABELS.show}
            aria-controls={id}
            onPress={() => setRevealed((value) => !value)}
            className="absolute inset-y-0.5 right-0.5 flex w-11 cursor-pointer items-center justify-center text-muted outline-link hover:text-ink focus-visible:outline-2"
          >
            {revealed ? (
              <EyeOff size={22} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Eye size={22} strokeWidth={1.75} aria-hidden="true" />
            )}
          </Button>
        )}
      </div>
      {error?.message && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm leading-normal text-error-text">
          <CircleAlert className="mt-0.5 shrink-0" size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>{error.message}</span>
        </p>
      )}
      {showHint && (
        <div id={hintId} className="text-sm leading-normal text-muted">
          {hint}
        </div>
      )}
    </div>
  );
};
