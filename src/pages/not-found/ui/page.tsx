import { Link } from "@effector/router-react";

import { routes } from "@/shared/routes";

export const NotFoundPage = () => {
  return (
    <section className="flex flex-col items-center gap-4 py-16">
      <h1 className="text-3xl font-semibold">404</h1>
      <p className="text-text-caption">Страница не найдена</p>
      <Link to={routes.home} className="text-system-primary underline">
        На главную
      </Link>
    </section>
  );
};
