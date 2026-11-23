import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui";

import { pageItems } from "../lib/pagination";

type Props = { page: number; total: number; onSelect: (page: number) => void };

const square = "size-11 shrink-0";
const outlined = "border-2 border-border-strong bg-card text-ink hover:bg-hover";
const arrowStyle = `${outlined} disabled:border-disabled-text disabled:bg-disabled-bg disabled:text-disabled-text`;

const PageRow = ({ page, total, onSelect, compact }: Props & { compact: boolean }) => {
  const [gapStart, setGapStart] = useState<number | null>(null);
  const items = pageItems(page, total, compact);
  const gap = items.find(({ from, to, skipped }) => skipped && from === gapStart && from < to);

  if (gapStart !== null && !gap) setGapStart(null);

  const select = (number: number) => {
    setGapStart(null);
    onSelect(number);
  };

  return (
    <div className={compact ? "md:hidden" : "hidden md:block"}>
      <div
        className={cn(
          "flex items-center justify-center",
          compact ? (items.length > 4 ? "gap-0.5" : "gap-1.5") : "flex-wrap gap-1.5",
        )}
      >
        <Button
          variant="brand-control"
          className={cn(arrowStyle, compact ? square : "h-11 px-6")}
          aria-label="Назад"
          isDisabled={page <= 1}
          onPress={() => select(page - 1)}
        >
          <ArrowLeft size={20} aria-hidden="true" />
          {!compact && "Назад"}
        </Button>

        {items.map(({ from, to, skipped }) =>
          skipped ? (
            <Button
              key={from}
              variant="brand-control"
              className={cn(square, "text-ink hover:bg-page")}
              aria-label={from === to ? "Перейти на страницу " + from : "Страницы " + from + "–" + to}
              aria-expanded={from === to ? undefined : gap?.from === from}
              onPress={() => (from === to ? select(from) : setGapStart(gapStart === from ? null : from))}
            >
              …
            </Button>
          ) : (
            <Button
              key={from}
              variant="brand-control"
              className={cn(
                square,
                page === from
                  ? "border-2 border-border-strong bg-brand-brown text-brand-gold hover:bg-button-hover"
                  : outlined,
              )}
              aria-label={"Страница " + from}
              aria-current={page === from ? "page" : undefined}
              onPress={() => select(from)}
            >
              {from}
            </Button>
          ),
        )}

        <Button
          variant="brand-control"
          className={cn(arrowStyle, compact ? square : "h-11 px-6")}
          aria-label="Вперёд"
          isDisabled={page >= total}
          onPress={() => select(page + 1)}
        >
          {!compact && "Вперёд"}
          <ArrowRight size={20} aria-hidden="true" />
        </Button>
      </div>

      {gap && (
        <form
          className="mt-3 flex flex-wrap items-center justify-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const number = Number(new FormData(event.currentTarget).get("page"));

            if (Number.isSafeInteger(number) && number >= gap.from && number <= gap.to) select(number);
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            Страница {gap.from}–{gap.to}
            <input
              name="page"
              type="number"
              min={gap.from}
              max={gap.to}
              required
              className="h-11 w-20 border-2 border-border-strong bg-white px-2 focus-visible:outline-link"
            />
          </label>
          <Button type="submit" variant="brand-secondary-small" className="h-11">
            Перейти
          </Button>
        </form>
      )}
    </div>
  );
};

export const ListPagination = (props: Props) => (
  <nav aria-label="Страницы списка" className="mt-12">
    <PageRow {...props} compact={false} />
    <PageRow {...props} compact />

    <p role="status" className="mt-3 text-center text-sm text-muted">
      Страница {props.page} из {props.total}
    </p>
  </nav>
);
