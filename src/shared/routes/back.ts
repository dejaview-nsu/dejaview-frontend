import { createEffect, createEvent, sample } from "effector";

import { router, routes } from "./routes";

export const backOrHomeRequested = createEvent();

const checkPreviousEntryFx = createEffect(() => {
  // The history adapter indexes entries within this app, unlike history.length,
  // which also includes pages visited before opening the app.
  const index: unknown = window.history.state?.idx;

  return typeof index === "number" && index > 0;
});

sample({ clock: backOrHomeRequested, target: checkPreviousEntryFx });

sample({ clock: checkPreviousEntryFx.doneData, filter: Boolean, fn: () => undefined, target: router.back });

sample({
  clock: checkPreviousEntryFx.doneData,
  filter: (hasPreviousEntry) => !hasPreviousEntry,
  fn: () => ({ replace: true, query: {} }),
  target: routes.home.open,
});
