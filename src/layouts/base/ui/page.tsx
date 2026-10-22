import { Link } from "@effector/router-react";
import { combine } from "effector";
import { useUnit } from "effector-react";
import { type ReactNode } from "react";

import { $$session } from "@/entities/session";

import { cn } from "@/shared/lib/cn";
import { routes } from "@/shared/routes";

import { HomeFooter } from "./home-footer";
import { HomeHeader } from "./home-header";
import { NotificationBanner } from "./notification-banner";
import { UserMenu } from "./user-menu";

const StandardHeader = () => {
  const status = useUnit($$session.outputs.$status);

  const linkStyle = "text-sm font-medium text-text-base hover:text-system-primary";

  return (
    <header className="border-b border-border-base px-6 py-4">
      <nav className="flex items-center gap-6">
        <Link to={routes.home} className={linkStyle}>
          Главная
        </Link>
        <Link to={routes.about} className={linkStyle}>
          О проекте
        </Link>
        <div className="ml-auto flex items-center gap-6">
          {status === "guest" && (
            <>
              <Link to={routes.login} className={linkStyle}>
                Войти
              </Link>
              <Link to={routes.register} className={linkStyle}>
                Зарегистрироваться
              </Link>
            </>
          )}
          {status === "authenticated" && <UserMenu className="text-text-base hover:text-system-primary" />}
        </div>
      </nav>
    </header>
  );
};

const $isBrandShell = combine(
  [routes.home.$isOpened, routes.register.$isOpened, routes.confirmEmail.$isOpened, routes.oidcCallback.$isOpened],
  (opened) => opened.some(Boolean),
);

const $isAuthPage = combine(
  [routes.register.$isOpened, routes.confirmEmail.$isOpened, routes.oidcCallback.$isOpened],
  (opened) => opened.some(Boolean),
);

export const BaseLayout = ({ children }: { children: ReactNode }) => {
  const { isBrandShell, isAuthPage } = useUnit({ isBrandShell: $isBrandShell, isAuthPage: $isAuthPage });

  return (
    <div
      className={cn(
        "relative flex min-h-dvh flex-col",
        isBrandShell
          ? "bg-page font-body text-ink md:border-x-[28px] md:border-brand-brown"
          : "bg-surface-page text-text-base",
      )}
    >
      {isBrandShell && (
        <>
          <span
            aria-hidden="true"
            className="film-perforations pointer-events-none absolute inset-y-3 -left-5 hidden w-3 md:block"
          />
          <span
            aria-hidden="true"
            className="film-perforations pointer-events-none absolute inset-y-3 -right-5 hidden w-3 md:block"
          />
        </>
      )}
      {isBrandShell ? <HomeHeader showGuestActions={!isAuthPage} /> : <StandardHeader />}
      <NotificationBanner />
      <main className={cn("mx-auto flex w-full flex-1 flex-col", !isBrandShell && "max-w-4xl p-6")}>{children}</main>
      {isBrandShell && <HomeFooter />}
    </div>
  );
};
