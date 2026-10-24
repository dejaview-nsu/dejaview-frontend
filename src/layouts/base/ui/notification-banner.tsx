import { useUnit } from "effector-react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "react-aria-components";

import { cn } from "@/shared/lib/cn";
import { $$notifications, NOTIFICATION_TIMEOUT_MS } from "@/shared/lib/notifications";

export const NotificationBanner = () => {
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

  const Icon = notification.tone === "success" ? CircleCheck : CircleAlert;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center px-4 md:top-20">
      <div
        role={notification.tone === "error" ? "alert" : "status"}
        className={cn(
          "pointer-events-auto flex w-full max-w-md items-start gap-3 border-2 px-4 py-3 font-body text-base leading-normal shadow-hard",
          notification.tone === "success"
            ? "border-success-text bg-success-bg text-success-text"
            : "border-error-text bg-error-bg text-error-text",
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
  );
};
