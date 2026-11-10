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
    {/* Запас по ширине и третий ряд закрывают края контейнера после поворота. */}
    <div className="absolute top-1/2 left-1/2 flex w-[calc(100%+80px)] min-w-[1248px] -translate-x-1/2 -translate-y-1/2 rotate-4 flex-col gap-3 md:w-[calc(100%+240px)] md:min-w-[1728px] md:gap-4">
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
        posters,
      ].map((row, index) => (
        <div key={index} className="grid grid-cols-12 gap-3 md:gap-4">
          {row.map(([title, year, color]) => (
            <div
              key={title}
              className={cn(
                "flex aspect-2/3 min-w-0 flex-col justify-end gap-1 overflow-hidden border border-poster-border p-2 md:p-3",
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
