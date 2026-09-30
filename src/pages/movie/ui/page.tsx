import { useUnit } from "effector-react";

import { routes } from "@/shared/routes";

export const MoviePage = () => {
  const { movieId } = useUnit(routes.movie.$params);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Фильм {movieId}</h1>
    </section>
  );
};
