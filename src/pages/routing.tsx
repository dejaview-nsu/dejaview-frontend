import { createRoutesView, createRouteView, withLayout } from "@effector/router-react";

import { BaseLayout } from "@/layouts/base";

import { routes } from "@/shared/routes";

import { AboutPage } from "./about";
import { ConfirmEmailPage } from "./confirm-email";
import { $$forgotPasswordRoute } from "./forgot-password";
import { ForgotPasswordPage } from "./forgot-password";
import { $$home } from "./home";
import { HomePage } from "./home";
import { $$loginRoute } from "./login";
import { LoginPage } from "./login";
import { MoviePage } from "./movie";
import { NotFoundPage } from "./not-found";
import { OidcCallbackPage } from "./oidc-callback";
import { $$profile } from "./profile";
import { ProfilePage } from "./profile";
import { $$register } from "./register";
import { RegisterPage } from "./register";
import { ResetPasswordPage } from "./reset-password";

const PageLoader = () => {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="size-8 animate-spin rounded-full border-2 border-border-base border-t-system-primary" />
    </div>
  );
};

export const Routing = createRoutesView({
  routes: withLayout(BaseLayout, [
    createRouteView({ route: $$home.outputs.readyRoute, view: HomePage }),
    createRouteView({ route: routes.about, view: AboutPage }),
    createRouteView({ route: routes.movie, view: MoviePage }),
    createRouteView({ route: $$loginRoute.outputs.readyRoute, view: LoginPage }),
    createRouteView({ route: $$register.outputs.readyRoute, view: RegisterPage }),
    createRouteView({ route: $$profile.outputs.readyRoute, view: ProfilePage }),
    createRouteView({ route: routes.confirmEmail, view: ConfirmEmailPage }),
    createRouteView({ route: $$forgotPasswordRoute.outputs.readyRoute, view: ForgotPasswordPage }),
    createRouteView({ route: routes.resetPassword, view: ResetPasswordPage }),
    createRouteView({ route: routes.oidcCallback, view: OidcCallbackPage }),
    createRouteView({ route: routes.notFound, view: NotFoundPage }),
  ]),
  otherwise: PageLoader,
});
