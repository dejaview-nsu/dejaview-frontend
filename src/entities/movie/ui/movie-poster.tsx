import { useState } from "react";

export const MoviePoster = ({ url, title }: { url: string | null; title: string }) => {
  const [failed, setFailed] = useState(false);
  if (!url || failed)
    return (
      <div
        role="img"
        aria-label={`Нет постера фильма «${title}»`}
        className="mx-auto aspect-[2/3] w-full max-w-[200px] shrink-0 rounded-sm bg-poster-placeholder"
      >
        <span className="sr-only">Нет постера</span>
      </div>
    );
  return (
    <img
      className="mx-auto aspect-[2/3] w-full max-w-[200px] shrink-0 rounded-sm object-cover"
      src={url}
      alt={`Постер фильма «${title}»`}
      onError={() => setFailed(true)}
    />
  );
};
