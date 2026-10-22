import { useUnit } from "effector-react";
import { CircleAlert, LoaderCircle } from "lucide-react";

import { Button, type ButtonProps } from "@/shared/ui";

import { type ResendConfirmationModel } from "../model";

export const ResendControls = ({
  model,
  label,
  variant = "brand-secondary",
}: {
  model: ResendConfirmationModel;
  label: string;
  variant?: ButtonProps["variant"];
}) => {
  const { countdown, canResend, pending, error, resend } = useUnit({
    countdown: model.outputs.$countdown,
    canResend: model.outputs.$canResend,
    pending: model.outputs.$pending,
    error: model.outputs.$error,
    resend: model.inputs.resendPressed,
  });

  return (
    <div className="flex w-full flex-col items-center gap-3 border-t border-dashed border-divider pt-5">
      <Button
        variant={variant}
        isDisabled={!canResend}
        aria-busy={pending}
        aria-describedby={countdown ? "resend-countdown" : undefined}
        onPress={() => resend()}
        className="disabled:border-disabled-text disabled:bg-disabled-bg disabled:text-disabled-text disabled:opacity-100"
      >
        {pending && (
          <LoaderCircle className="motion-safe:animate-spin" size={20} strokeWidth={1.75} aria-hidden="true" />
        )}
        {label}
      </Button>
      {countdown && (
        <p id="resend-countdown" className="text-sm leading-normal text-muted">
          Можно отправить ещё раз через {countdown}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 border-2 border-error-text bg-error-bg px-4 py-3 text-left text-sm leading-normal text-error-text"
        >
          <CircleAlert className="shrink-0" size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
