import { useUnit } from "effector-react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "react-aria-components";

import { cn } from "@/shared/lib/cn";
import { $$notifications, NOTIFICATION_TIMEOUT_MS, type NotificationTone } from "@/shared/lib/notifications";

const TONE_ICONS = { success: CircleCheck, error: CircleAlert, info: Info } satisfies Record<NotificationTone, unknown>;

const TONE_STYLES = {
  success: "border-success-text bg-success-bg text-success-text",
  error: "border-error-text bg-error-bg text-error-text",
  info: "border-border-strong bg-card text-ink shadow-hard",
} satisfies Record<NotificationTone, string>;

export const NotificationBanner = ({ contentWidth = false }: { contentWidth?: boolean }) => {
  const { notification, dismiss } = useUnit({
    notification: $$notifications.outputs.$notification,
    dismiss: $$notifications.inputs.dismissed,
  });

  useEffect(() => {
    if (!notification) return;

    const timer = setTimeout(() => dismiss(notification.id), NOTIFICATION_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [notification, dismiss]);

  if (!notification) return null;

  const Icon = TONE_ICONS[notification.tone];

  return (
    <div className={cn("pointer-events-none absolute inset-0 z-40 px-4", contentWidth ? "md:px-8" : "md:px-12")}>
      <div
        className={cn(
          "sticky top-4 mx-auto mt-2 flex w-full justify-center md:mt-4 md:justify-end",
          contentWidth ? "max-w-content" : "max-w-results",
        )}
      >
        <div
          role={notification.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full items-center gap-3 border-2 py-2 pr-2 pl-3 font-body text-base leading-normal font-medium md:w-auto md:max-w-md",
            TONE_STYLES[notification.tone],
          )}
        >
          <Icon className="shrink-0" size={24} strokeWidth={1.75} aria-hidden="true" />
          <span>{notification.text}</span>
          <Button
            aria-label="Закрыть"
            onPress={() => dismiss(notification.id)}
            className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center outline-link"
          >
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
};
