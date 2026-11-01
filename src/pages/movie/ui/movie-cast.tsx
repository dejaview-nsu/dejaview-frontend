import { UserRound } from "lucide-react";
import { useState } from "react";

import { type MovieActor } from "@/shared/api";

const ActorPortrait = ({ actor }: { actor: MovieActor }) => {
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex aspect-[2/3] items-center justify-center overflow-hidden border-2 border-border-strong bg-poster-placeholder text-on-dark">
      {actor.photo_url && !failed ? (
        <img
          src={actor.photo_url}
          alt={actor.name}
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span role="img" aria-label={`Нет фото: ${actor.name}`}>
          <UserRound size={40} aria-hidden="true" />
        </span>
      )}
    </div>
  );
};

export const MovieCast = ({ actors }: { actors: MovieActor[] }) => (
  <section aria-labelledby="movie-cast-title" className="flex flex-col gap-6 border-t-2 border-border-strong pt-8">
    <h2 id="movie-cast-title" className="font-heading text-mobile-heading-2 font-bold md:text-heading-2">
      Актёры
    </h2>
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {actors.map((actor) => (
        <li key={actor.person_id} className="flex min-w-0 flex-col gap-2">
          <ActorPortrait key={actor.photo_url} actor={actor} />
          <p className="text-sm font-bold break-words">{actor.name}</p>
          {actor.character && <p className="text-sm text-muted break-words">{actor.character}</p>}
        </li>
      ))}
    </ul>
  </section>
);
