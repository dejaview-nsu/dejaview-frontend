import { MessageSquare, Star } from "lucide-react";

import { PROFILE_TEXTS } from "../config";

const ICONS = { ratings: Star, reviews: MessageSquare };

export const ComingSoon = ({ section }: { section: "ratings" | "reviews" }) => {
  const Icon = ICONS[section];

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-12 text-center md:py-16">
      <span className="flex size-16 items-center justify-center bg-header text-brand-gold" aria-hidden="true">
        <Icon size={28} strokeWidth={1.75} />
      </span>
      <h2 className="font-heading text-mobile-heading-2 font-bold">{PROFILE_TEXTS.comingSoonTitle}</h2>
      <p className="max-w-search text-base leading-normal text-muted">{PROFILE_TEXTS.comingSoonHint[section]}</p>
    </div>
  );
};
