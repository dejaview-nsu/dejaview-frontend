import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { type ReactNode } from "react";

import { $$session } from "@/entities/session";

import { routes } from "@/shared/routes";
import { Button } from "@/shared/ui/button";

const SessionLinks = () => {
  const { status, signOut } = useUnit({
    status: $$session.outputs.$status,
    signOut: $$session.inputs.signedOut,
  });

  if (status === "guest") {
    return (
      <div className="ml-auto flex items-center gap-6">
        <Link to={routes.login} className="text-sm font-medium text-text-base hover:text-system-primary">
          Войти
        </Link>
        <Link to={routes.register} className="text-sm font-medium text-text-base hover:text-system-primary">
          Зарегистрироваться
        </Link>
      </div>
    );
  }

  if (status === "authenticated") {
    return (
      <div className="ml-auto flex items-center gap-6">
        <Link to={routes.profile} className="text-sm font-medium text-text-base hover:text-system-primary">
          Профиль
        </Link>
        <Button variant="ghost" onPress={() => signOut()}>
          Выйти
        </Button>
      </div>
    );
  }

  return null;
};

export const BaseLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-dvh bg-surface-page text-text-base">
      <header className="border-b border-border-base px-6 py-4">
        <nav className="flex items-center gap-6">
          <Link to={routes.home} className="text-sm font-medium text-text-base hover:text-system-primary">
            Главная
          </Link>
          <Link to={routes.about} className="text-sm font-medium text-text-base hover:text-system-primary">
            О проекте
          </Link>
          <SessionLinks />
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl p-6">{children}</main>
    </div>
  );
};
