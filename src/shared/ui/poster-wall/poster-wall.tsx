import { cn } from "../../lib/cn";

const posters = [
  ["Джокер", "2019", "bg-brand-brown"],
  ["Марсианин", "2015", "bg-poster-warm"],
  ["Кин-дза-дза!", "1986", "bg-poster-placeholder"],
  ["Дюна", "2021", "bg-link"],
  ["Одержимость", "2014", "bg-terracotta-text"],
  ["Зеркало", "1975", "bg-poster-border"],
  ["Остров", "2006", "bg-button-pressed"],
  ["Амели", "2001", "bg-link"],
  ["Сталкер", "1979", "bg-brand-brown"],
  ["Матрица", "1999", "bg-button-pressed"],
  ["Паразиты", "2019", "bg-terracotta-text"],
  ["Брат", "1997", "bg-brand-brown"],
] as const;

export const PosterWall = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute top-2 -left-10 flex origin-top-left rotate-4 flex-col gap-3 md:top-0 md:-left-[120px] md:gap-4">
      {[
        posters,
        [
          posters[5],
          posters[2],
          posters[11],
          posters[4],
          posters[1],
          posters[6],
          posters[7],
          posters[0],
          posters[8],
          posters[10],
          posters[3],
          posters[9],
        ],
      ].map((row, index) => (
        <div key={index} className="flex gap-3 md:gap-4">
          {row.map(([title, year, color]) => (
            <div
              key={title}
              className={cn(
                "flex h-[137px] w-[91px] shrink-0 flex-col justify-end gap-1 overflow-hidden border border-poster-border p-2 md:h-48 md:w-32 md:p-3",
                color,
              )}
            >
              <span className="font-heading text-[11px] font-bold text-on-dark md:text-[15px]">{title}</span>
              <span className="font-label text-[8px] font-semibold text-brand-gold md:text-[11px]">{year}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
    <div className="absolute inset-0 bg-header/80" />
  </div>
);
