import { redirect } from "@effector/router";
import { createEvent, sample } from "effector";

import { routes } from "./routes";

export const loginRedirectRequested = createEvent<{ path: string; replace?: boolean }>();

sample({
  clock: loginRedirectRequested,
  fn: ({ path, replace }) => ({ query: { redirect: path }, replace }),
  target: redirect({ to: routes.login }),
});
