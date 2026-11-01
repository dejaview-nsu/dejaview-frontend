import { useState } from "react";

import { cn } from "@/shared/lib/cn";

export const MoviePoster = ({
  url,
  title,
  variant = "card",
}: {
  url: string | null;
  title: string;
  variant?: "card" | "detail";
}) => {
  const [failed, setFailed] = useState(false);
  const className = cn(
    "mx-auto aspect-[2/3] w-full shrink-0 object-cover",
    variant === "card" ? "max-w-[200px] rounded-sm" : "border-2 border-border-strong shadow-hard-lg",
  );

  if (!url || failed)
    return (
      <div
        role="img"
        aria-label={`Нет постера фильма «${title}»`}
        className={cn(
          className,
          "flex items-center justify-center bg-poster-placeholder p-6 text-center text-sm text-on-dark",
        )}
      >
        <span className={variant === "card" ? "sr-only" : undefined}>Нет постера</span>
      </div>
    );
  return <img className={className} src={url} alt={`Постер фильма «${title}»`} onError={() => setFailed(true)} />;
};
