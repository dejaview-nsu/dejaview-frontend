import { Link } from "@effector/router-react";
import { type ReactNode } from "react";

import { routes } from "@/shared/routes";

export const BaseLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-dvh bg-surface-page text-text-base">
      <header className="border-b border-border-base px-6 py-4">
        <nav className="flex gap-6">
          <Link to={routes.home} className="text-sm font-medium text-text-base hover:text-system-primary">
            Главная
          </Link>
          <Link to={routes.about} className="text-sm font-medium text-text-base hover:text-system-primary">
            О проекте
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl p-6">{children}</main>
    </div>
  );
};
