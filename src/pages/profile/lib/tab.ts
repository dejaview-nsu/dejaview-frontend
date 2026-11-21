import { type ListTypePath } from "@/shared/api";

export const PROFILE_TABS = ["want_to_watch", "watched", "ratings", "reviews", "security"] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

export const LIST_TABS = ["want_to_watch", "watched"] as const satisfies readonly (ListTypePath & ProfileTab)[];

export const DEFAULT_PROFILE_TAB: ProfileTab = "want_to_watch";

export const isProfileTab = (value: unknown): value is ProfileTab =>
  typeof value === "string" && (PROFILE_TABS as readonly string[]).includes(value);

export const isListTab = (value: ProfileTab): value is ListTypePath & ProfileTab =>
  (LIST_TABS as readonly string[]).includes(value);

export const parseProfileTab = (value: unknown): ProfileTab => (isProfileTab(value) ? value : DEFAULT_PROFILE_TAB);
