import { createFactory } from "@withease/factories";
import { createEvent, createStore, type Event, type EventCallable, sample, type Store } from "effector";
import { and, not, readonly } from "patronum";

import { type SignOutOptions } from "@/entities/session";

import { type ApiError } from "@/shared/api";

import { PROFILE_TEXTS } from "../config";

export const createSignOutDialogFactory = createFactory(
  ({
    signOut,
    signOutFailed,
    $pending,
  }: {
    signOut: EventCallable<SignOutOptions>;
    signOutFailed: Event<ApiError>;
    $pending: Store<boolean>;
  }) => {
    const opened = createEvent();
    const dismissed = createEvent();
    const confirmed = createEvent();
    const closed = createEvent();

    const $isOpen = createStore(false);
    const $error = createStore<string | null>(null);

    sample({ clock: opened, fn: () => true, target: $isOpen });

    sample({ clock: opened, fn: () => null, target: $error });

    const confirmStarted = sample({ clock: confirmed, filter: and($isOpen, not($pending)) });

    sample({ clock: confirmStarted, fn: () => null, target: $error });

    sample({ clock: confirmStarted, fn: () => ({ errors: "caller" as const }), target: signOut });

    sample({
      clock: signOutFailed,
      filter: $isOpen,
      fn: () => PROFILE_TEXTS.signOutDialog.failed,
      target: $error,
    });

    const closeStarted = sample({ clock: dismissed, filter: not($pending) });

    sample({ clock: [closeStarted, closed], fn: () => false, target: $isOpen });

    sample({ clock: [closeStarted, closed], fn: () => null, target: $error });

    return {
      inputs: { opened, dismissed, confirmed, closed },
      outputs: { $isOpen: readonly($isOpen), $error: readonly($error), $pending },
    };
  },
);
