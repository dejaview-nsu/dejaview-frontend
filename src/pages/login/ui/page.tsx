import { useUnit } from "effector-react";

import { LoginForm } from "@/widgets/login-form";

import { router } from "@/shared/routes";
import { PosterWall } from "@/shared/ui";

import { $$login } from "../model";

export const LoginPage = () => {
  const query = useUnit(router.$query);

  return (
    <div className="flex flex-1 flex-col font-body text-ink">
      <div className="relative hidden h-72 overflow-hidden bg-header text-on-dark md:block">
        <PosterWall />
        <div className="relative mx-auto max-w-content px-6 pt-12 text-center">
          <p className="font-heading text-[56px]/[1.1] font-extrabold">С возвращением!</p>
          <p className="mx-auto mt-4.5 max-w-140 text-lg/[1.6] font-semibold">
            Войди, чтобы сохранять фильмы в списки, ставить оценки и искать по кадру, видео и звуку
          </p>
        </div>
      </div>
      <section
        aria-labelledby="login-title"
        className="relative mx-auto flex w-full flex-1 flex-col gap-4.5 bg-card px-12 pt-12 pb-12 md:-mt-20 md:mb-24 md:max-w-110 md:flex-none md:border-2 md:border-border-strong md:p-8 md:shadow-hard-xl"
      >
        <h1
          id="login-title"
          className="p-2.5 text-center font-heading text-mobile-heading-2 font-extrabold text-black md:text-[28px]/[1.1] md:text-left"
        >
          Вход в DejaView
        </h1>
        <LoginForm
          model={$$login}
          id="login-page"
          registerPath={typeof query.redirect === "string" ? query.redirect : null}
        />
      </section>
    </div>
  );
};
