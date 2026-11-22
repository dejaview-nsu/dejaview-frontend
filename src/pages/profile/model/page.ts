import { invoke } from "@withease/factories";
import { createEvent, sample } from "effector";

import { createChangePasswordFactory } from "@/features/change-password";
import { createListRemovalFactory } from "@/features/movie-lists";

import { $$session, createAuthorizedRouteFactory } from "@/entities/session";

import { isSessionError } from "@/shared/api";
import { $$notifications } from "@/shared/lib/notifications";
import { router, routes } from "@/shared/routes";

import type { ListQuery } from "../api/request";
import { PROFILE_TEXTS } from "../config";
import { DEFAULT_PROFILE_TAB, isListTab, isProfileTab, parseProfileTab, type ProfileTab } from "../lib";
import { createProfileListFactory } from "./list";
import { createProfileFactory } from "./profile";
import { createSignOutDialogFactory } from "./sign-out";

export const $$profile = invoke(createAuthorizedRouteFactory, { route: routes.profile, session: $$session });
export const $$userProfile = invoke(createProfileFactory);
export const $$profileList = invoke(createProfileListFactory);
export const $$listRemoval = invoke(createListRemovalFactory);
export const $$changePassword = invoke(createChangePasswordFactory, {
  $hasPassword: $$session.outputs.$user.map((user) => user?.has_password ?? true),
});
export const $$signOutDialog = invoke(createSignOutDialogFactory, {
  signOut: $$session.inputs.signOutRequested,
  signOutFailed: $$session.outputs.signOutFailed,
  $pending: $$session.outputs.$isSigningOut,
});

const { readyRoute } = $$profile.outputs;

export const tabSelected = createEvent<ProfileTab>();
export const comingSoonPressed = createEvent();

const $rawTab = router.$query.map((query) => query.tab ?? null);

export const $tab = $rawTab.map(parseProfileTab);

const $listQuery = $tab.map((tab): ListQuery | null =>
  isListTab(tab) ? { list: tab, sort: "newest", q: "", page: 1 } : null,
);

sample({ clock: readyRoute.opened, target: $$userProfile.inputs.opened });

const listQueryChanged = sample({
  clock: [readyRoute.opened, $listQuery],
  source: $listQuery,
  filter: readyRoute.$isOpened,
});

sample({
  clock: listQueryChanged,
  filter: (query): query is ListQuery => query !== null,
  target: $$profileList.inputs.opened,
});

sample({ clock: listQueryChanged, filter: (query) => query === null, target: $$profileList.inputs.closed });

sample({ clock: $tab, filter: (tab) => tab !== "security", target: $$changePassword.inputs.reset });

sample({
  clock: [readyRoute.opened, $rawTab],
  source: { tab: $rawTab, query: router.$query, opened: readyRoute.$isOpened },
  filter: ({ tab, opened }) => opened && tab !== null && !isProfileTab(tab),
  fn: ({ query }) => ({
    query: Object.fromEntries(Object.entries(query).filter(([key]) => key !== "tab")),
    replace: true,
  }),
  target: routes.profile.open,
});

sample({
  clock: tabSelected,
  source: $tab,
  filter: (current, tab) => current !== tab,
  fn: (_, tab) => ({ query: tab === DEFAULT_PROFILE_TAB ? {} : { tab } }),
  target: routes.profile.open,
});

sample({
  clock: readyRoute.closed,
  target: [
    $$userProfile.inputs.closed,
    $$profileList.inputs.closed,
    $$listRemoval.inputs.reset,
    $$changePassword.inputs.reset,
    $$signOutDialog.inputs.closed,
  ],
});

sample({ clock: $$listRemoval.outputs.removed, target: $$profileList.inputs.movieRemoved });

sample({
  clock: $$listRemoval.outputs.removed,
  filter: ({ list }) => list === "watched",
  target: $$userProfile.inputs.refreshed,
});

sample({
  clock: $$listRemoval.outputs.failed,
  filter: ({ error }) => !isSessionError(error),
  fn: () => ({ text: PROFILE_TEXTS.removeFailed, tone: "error" as const }),
  target: $$notifications.inputs.shown,
});

sample({ clock: $$changePassword.outputs.succeeded, target: $$session.inputs.passwordSet });

sample({
  clock: comingSoonPressed,
  fn: () => ({ text: PROFILE_TEXTS.comingSoon, tone: "info" as const }),
  target: $$notifications.inputs.shown,
});
