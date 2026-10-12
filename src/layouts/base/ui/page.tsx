import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { type ReactNode } from "react";

import { $$session } from "@/entities/session";

import { cn } from "@/shared/lib/cn";
import { routes } from "@/shared/routes";
import { Button } from "@/shared/ui/button";

import { HomeFooter } from "./home-footer";
import { HomeHeader } from "./home-header";

const StandardHeader = () => {
  const { status, signOut } = useUnit({
    status: $$session.outputs.$status,
    signOut: $$session.inputs.signedOut,
  });

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
          {status === "authenticated" && (
            <>
              <Link to={routes.profile} className={linkStyle}>
                Профиль
              </Link>
              <Button variant="ghost" onPress={() => signOut()}>
                Выйти
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

export const BaseLayout = ({ children }: { children: ReactNode }) => {
  const isHome = useUnit(routes.home.$isOpened);

  return (
    <div
      className={cn(
        "min-h-dvh",
        isHome
          ? "relative bg-page font-body text-ink md:border-x-[28px] md:border-brand-brown"
          : "bg-surface-page text-text-base",
      )}
    >
      {isHome && (
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
      {isHome ? <HomeHeader /> : <StandardHeader />}
      <main className={cn("mx-auto w-full", !isHome && "max-w-4xl p-6")}>{children}</main>
      {isHome && <HomeFooter />}
    </div>
  );
};
