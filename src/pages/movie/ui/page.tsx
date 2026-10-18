import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";

import { routes } from "@/shared/routes";

export const MoviePage = () => {
  const { movieId } = useUnit(routes.movie.$params);

  return (
    <section className="mx-auto my-12 flex max-w-search flex-col gap-4 border-2 border-border-strong bg-card p-6 font-body shadow-hard-lg">
      <h1 className="font-heading text-mobile-heading-2 font-bold md:text-heading-2">Карточка фильма скоро появится</h1>
      <p className="text-base leading-[1.55] text-muted">
        Подробная информация о фильме {movieId} будет доступна в следующем обновлении.
      </p>
      <Link
        to={routes.home}
        className="min-h-11 py-3 font-label font-semibold tracking-widest text-link uppercase hover:underline"
      >
        Вернуться к поиску
      </Link>
    </section>
  );
};
