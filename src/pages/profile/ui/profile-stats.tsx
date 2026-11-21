import { type UserProfile } from "@/shared/api";
import { formatRating } from "@/shared/lib/format";

import { PROFILE_TEXTS } from "../config";

export const ProfileStats = ({ stats }: { stats: UserProfile["stats"] }) => {
  const hasRatings = stats.ratings_count > 0;
  const items = [
    { label: PROFILE_TEXTS.stats.watched, value: String(stats.watched_count) },
    { label: PROFILE_TEXTS.stats.ratings, value: String(stats.ratings_count) },
    { label: PROFILE_TEXTS.stats.averageRating, value: hasRatings ? formatRating(stats.average_rating) : null },
    { label: PROFILE_TEXTS.stats.reviews, value: String(stats.reviews_count) },
  ];

  return (
    <dl
      aria-label={PROFILE_TEXTS.statsLabel}
      className="grid w-full grid-cols-4 divide-x divide-dashed divide-divider md:w-auto"
    >
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="flex min-w-0 flex-col-reverse items-center justify-start gap-1 px-1.5 py-1 text-center md:min-w-[148px] md:px-6 md:py-2"
        >
          <dt className="font-label text-xs leading-[1.2] font-semibold tracking-wider text-muted uppercase md:text-sm md:tracking-widest">
            {label}
          </dt>
          <dd className="font-heading text-xl leading-none font-bold text-ink md:text-[28px]">
            {value ?? (
              <span role="img" aria-label={PROFILE_TEXTS.noRatings}>
                —
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
};
