import { CircleAlert, PencilLine } from "lucide-react";

import { Button } from "@/shared/ui/button";

export const SearchEmpty = () => (
  <div
    role="status"
    aria-live="polite"
    className="mx-auto flex max-w-[737px] items-start gap-4 border-2 border-border-strong bg-card p-4 shadow-hard-lg md:p-6"
  >
    <CircleAlert className="shrink-0 text-muted" size={32} strokeWidth={1.75} aria-hidden="true" />
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <h2 className="font-heading text-mobile-heading-3 font-bold md:text-heading-3">Ничего не нашлось</h2>
        <p className="text-base leading-[1.55]">Попробуйте загрузить другой файл и повторить поиск.</p>
      </div>
      <Button
        variant="brand-secondary"
        className="self-start px-3 md:px-6"
        onPress={() => {
          const input = document.getElementById("search-file-action");
          input?.scrollIntoView?.({ block: "center" });
          input?.focus({ preventScroll: true });
        }}
      >
        <PencilLine size={24} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
        Изменить файл
      </Button>
    </div>
  </div>
);
