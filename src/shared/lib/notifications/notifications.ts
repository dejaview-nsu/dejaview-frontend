import { createFactory, invoke } from "@withease/factories";
import { createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

export type NotificationTone = "success" | "error";

export type Notification = { id: number; text: string; tone: NotificationTone };

export const NOTIFICATION_TIMEOUT_MS = 6000;

export const createNotificationsFactory = createFactory(() => {
  const shown = createEvent<{ text: string; tone: NotificationTone }>();
  const dismissed = createEvent<number>();

  const $notification = createStore<Notification | null>(null);

  sample({
    clock: shown,
    source: $notification,
    fn: (previous, { text, tone }) => ({ id: (previous?.id ?? 0) + 1, text, tone }),
    target: $notification,
  });

  sample({
    clock: dismissed,
    source: $notification,
    filter: (current, id) => current?.id === id,
    fn: () => null,
    target: $notification,
  });

  return {
    inputs: { shown, dismissed },
    outputs: { $notification: readonly($notification) },
  };
});

export const $$notifications = invoke(createNotificationsFactory);
