import { useUnit } from "effector-react";
import { ArrowDown, ArrowUp, Search, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui";

import { type ListSort } from "../api/request";
import { type createProfileListFactory } from "../model/list";

const sorts = [
  { label: "Дата", first: "newest", second: "oldest", firstLabel: "Сначала новые", secondLabel: "Сначала старые" },
  { label: "Название", first: "title_asc", second: "title_desc", firstLabel: "А-Я", secondLabel: "Я-А" },
  { label: "Оценка", first: "best", second: "worst", firstLabel: "Сначала лучшие", secondLabel: "Сначала худшие" },
] as const;

export const ListToolbar = ({
  model,
  sort,
}: {
  model: ReturnType<typeof createProfileListFactory>;
  sort: ListSort;
}) => {
  const { draft, changeDraft, submit, clear, selectSort } = useUnit({
    draft: model.outputs.$draft,
    changeDraft: model.inputs.draftChanged,
    submit: model.inputs.searchSubmitted,
    clear: model.inputs.searchCleared,
    selectSort: model.inputs.sortSelected,
  });

  return (
    <div className="mb-9 flex flex-col gap-4 md:mb-11 md:gap-8">
      <form
        role="search"
        className="flex flex-wrap justify-center gap-3 md:justify-start"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex h-12 w-full items-center gap-1.5 border border-disabled-text bg-white pl-4 text-muted focus-within:outline-2 focus-within:outline-link md:w-90">
          <Search size={18} aria-hidden="true" />
          <input
            className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
            aria-label="Поиск по названию"
            placeholder="Поиск по названию"
            value={draft}
            onChange={(event) => changeDraft(event.currentTarget.value)}
          />
          <button
            type="button"
            aria-label="Очистить"
            className="grid size-11 place-items-center focus-visible:outline-2 focus-visible:outline-link md:hidden"
            onClick={() => clear()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <Button type="submit" variant="brand" className="w-60 max-w-full md:w-auto">
          Найти
        </Button>
        <div className="hidden md:block">
          <Button variant="brand-secondary" onPress={() => clear()}>
            Очистить
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-8">
        <span className="text-sm text-muted">Сортировка:</span>

        <div
          role="group"
          aria-label="Сортировка"
          className="inline-flex h-11 w-full border-2 border-border-strong md:w-fit"
        >
          {sorts.map(({ label, first, second, firstLabel, secondLabel }) => {
            const active = sort === first || sort === second;
            const reversed = sort === second;
            const Direction = reversed ? ArrowUp : ArrowDown;
            const next = sort === first ? second : first;

            return (
              <Button
                key={first}
                variant="brand-control"
                className={cn(
                  "min-w-0 flex-auto px-2 not-last:border-r-2 not-last:border-border-strong focus-visible:ring-inset md:flex-none md:px-6",
                  active ? "bg-brand-brown text-brand-gold hover:bg-button-hover" : "bg-card text-ink hover:bg-hover",
                )}
                aria-pressed={active}
                aria-label={
                  active
                    ? label + ", " + (reversed ? secondLabel : firstLabel) + ". Переключить направление"
                    : label + ", " + firstLabel
                }
                onPress={() => selectSort(next)}
              >
                {label}
                {active && <Direction size={18} aria-hidden="true" />}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
