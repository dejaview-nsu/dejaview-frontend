import { createEffect } from "effector";

import { type ApiRequest, sendApiRequest } from "@/shared/api";

export const sendApiRequestFx = createEffect((request: ApiRequest<unknown>) => sendApiRequest(request));
