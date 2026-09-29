import { chainRoute, type Route } from "@effector/router";
import { createFactory } from "@withease/factories";
import { createEvent, sample } from "effector";
import { readonly } from "patronum";

import { createPostQuery } from "../api/request";

export const createHomePageFactory = createFactory(({ route }: { route: Route }) => {
  const postQuery = createPostQuery();

  const pageLoadStarted = createEvent();
  const refreshRequested = createEvent();

  const readyRoute = chainRoute({
    route,
    beforeOpen: pageLoadStarted,
    openOn: postQuery.finished.finally,
  });

  sample({ clock: pageLoadStarted, target: postQuery.start });
  sample({ clock: refreshRequested, target: postQuery.start });
  sample({ clock: route.closed, target: postQuery.reset });

  return {
    __: { postQuery, readyRoute },
    inputs: { refreshRequested },
    outputs: {
      readyRoute,
      $post: readonly(postQuery.$data),
      $pending: readonly(postQuery.$pending),
      $error: readonly(postQuery.$error),
    },
  };
});
