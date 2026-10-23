import { PosterWall } from "@/shared/ui";

export const HomeIntro = () => (
  <section className="relative h-96 overflow-hidden bg-header px-4 pt-[84px] text-on-dark md:h-[488px] md:px-8 md:pt-[106px]">
    <PosterWall />
    <div className="relative mx-auto max-w-content">
      <h1 className="text-center font-heading text-mobile-heading-1 font-extrabold md:text-heading-1 desktop:text-hero">
        Найди фильм<span className="hidden md:inline"> по </span>
        <br className="md:hidden" />
        <span className="md:hidden">по </span>
        <em className="font-semibold text-brand-gold">обрывку памяти</em>
      </h1>
      <p className="mt-14 max-w-[304px] text-base leading-[1.55] md:hidden">
        Выбери, что помнишь:
        <br />
        сцену, кадр, фрагмент видео или звук
      </p>
      <p className="mx-auto mt-6 hidden max-w-[640px] text-center text-[19px] leading-[1.55] font-extrabold md:block">
        Выбери, что помнишь: сцену своими словами, кадр, фрагмент видео или звук — DejaView найдёт фильм по смыслу
      </p>
    </div>
  </section>
);
