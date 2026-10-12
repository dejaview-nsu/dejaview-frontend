import { cn } from "@/shared/lib/cn";

const steps = [
  ["Выбери, что помнишь", "Текст, кадр, видео или звук — ищи тем, что осталось в памяти"],
  ["Опиши или загрузи", "Своими словами, как рассказал бы другу. Точность не нужна."],
  ["Узнай фильм", "Открой карточку, добавь в «Хочу посмотреть» и оцени после просмотра"],
];

export const HowItWorks = () => (
  <section className="mx-auto mt-[92px] max-w-content md:mt-24" aria-labelledby="how-heading">
    <h2
      id="how-heading"
      className="mb-8 font-heading text-mobile-heading-2 leading-[1.1] font-extrabold md:text-section"
    >
      Как это <em className="font-semibold text-terracotta">работает?</em>
    </h2>
    <ol className="grid list-none grid-cols-1 border-t-2 border-border-strong lg:grid-cols-3">
      {steps.map(([title, description], index) => (
        <li
          key={title}
          className={cn(
            "flex min-h-[141px] items-start gap-5 px-2 pt-7 pb-4 lg:px-5 lg:pb-0",
            index > 0 && "border-t-2 border-dashed border-divider lg:border-t-0 lg:border-l-2",
          )}
        >
          <span className="shrink-0 font-heading text-[40px]/[1.1] font-extrabold text-terracotta md:text-[56px]">
            0{index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="mb-2 font-heading text-mobile-heading-3 font-bold md:text-heading-3">{title}</h3>
            <p className="text-sm leading-[1.55] text-muted md:text-base">{description}</p>
          </div>
        </li>
      ))}
    </ol>
  </section>
);
