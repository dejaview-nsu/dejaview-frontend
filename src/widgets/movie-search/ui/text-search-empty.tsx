import { SearchX } from "lucide-react";

import { textSearchTexts } from "@/features/search-by-description";

import { Button } from "@/shared/ui/button";

import { TEXT_DESCRIPTION_ID } from "./text-description";

const focusDescription = () => {
  const input = document.getElementById(TEXT_DESCRIPTION_ID);

  input?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  input?.focus({ preventScroll: true });
};

export const TextSearchEmpty = ({ onSearchAgain }: { onSearchAgain: () => void }) => (
  <div
    role="status"
    aria-live="polite"
    className="mx-auto flex max-w-content flex-col gap-4 border-2 border-border-strong bg-card p-4 shadow-hard-lg md:flex-row md:gap-8 md:p-8"
  >
    <span
      aria-hidden="true"
      className="flex size-14 shrink-0 items-center justify-center bg-header text-brand-gold md:size-[72px]"
    >
      <SearchX size={28} strokeWidth={1.75} />
    </span>

    <div className="flex min-w-0 flex-col gap-3">
      <h2 className="font-heading text-mobile-heading-3 font-bold md:text-heading-2 md:font-extrabold">
        {textSearchTexts.emptyTitle}
      </h2>
      <p className="text-base leading-[1.55]">{textSearchTexts.emptyText}</p>

      <h3 className="mt-1 font-label text-sm leading-[1.2] font-semibold tracking-widest text-terracotta-text uppercase">
        {textSearchTexts.emptyTipsTitle}
      </h3>
      <ul className="list-disc pl-5 text-base leading-[1.55] text-muted">
        {textSearchTexts.emptyTips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Button variant="brand" className="px-4 md:px-6" onPress={focusDescription}>
          {textSearchTexts.editQuery}
        </Button>
        <Button variant="brand-secondary" className="px-4 md:px-6" onPress={onSearchAgain}>
          {textSearchTexts.searchAgain}
        </Button>
      </div>
    </div>
  </div>
);
