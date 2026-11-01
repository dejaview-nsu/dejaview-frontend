import { type MovieCard, type MovieReview } from "@/shared/api";

const CREW_ROLES = [
  ["director", "Режиссёр", "Режиссёры"],
  ["writer", "Сценарист", "Сценаристы"],
  ["composer", "Композитор", "Композиторы"],
  ["producer", "Продюсер", "Продюсеры"],
] as const;

export const movieFacts = (movie: MovieCard) => {
  const rows: { label: string; value: string }[] = [];
  const addNames = (singular: string, plural: string, names: string[]) => {
    if (names.length > 0) rows.push({ label: names.length === 1 ? singular : plural, value: names.join(", ") });
  };

  addNames(
    "Страна",
    "Страны",
    movie.countries.map(({ name }) => name),
  );
  addNames(
    "Жанр",
    "Жанры",
    movie.genres.map(({ name }) => name),
  );

  if (movie.runtime_min !== null) {
    rows.push({
      label: "Длительность",
      value: `${Math.floor(movie.runtime_min / 60)} ч ${movie.runtime_min % 60} мин`,
    });
  }

  for (const [role, singular, plural] of CREW_ROLES) {
    addNames(
      singular,
      plural,
      movie.crew.filter((person) => person.role === role).map(({ name }) => name),
    );
  }

  return rows;
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false });

export const reviewDate = (value: string) => {
  const date = new Date(value);

  return `${dateFormatter.format(date).replace(/\s*г\.$/, "")}, ${timeFormatter.format(date)}`;
};

export const reactionScore = ({ likes, dislikes }: Pick<MovieReview, "likes" | "dislikes">) => {
  const score = likes - dislikes;

  return score > 0 ? `+${score}` : String(score);
};
