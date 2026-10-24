import { invoke } from "@withease/factories";

import { createOidcCallbackPageFactory } from "./oidc-callback";

export const $$oidcCallback = invoke(createOidcCallbackPageFactory);
