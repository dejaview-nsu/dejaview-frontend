import type { ListMovieReviewsData, MovieCard, MovieReview } from "../generated";
import { TransportError } from "../transport/errors";
import { FOUND_RESULTS, TEXT_FOUND_RESULTS } from "./fixtures";
import { MOCK_STORAGE_KEYS } from "./storage";
import { type MockHandler, mockResponse, wait } from "./utils";

export const MOVIE_SCENARIOS = [
  "found",
  "empty",
  "MOVIE_NOT_FOUND",
  "MOVIE_UNAVAILABLE",
  "NETWORK_ERROR",
  "TIMEOUT",
] as const;
export const REVIEW_SCENARIOS = ["found", "empty", "error"] as const;

export const MOVIE_FIXTURE: MovieCard = {
  movie_id: 157336,
  title: "Интерстеллар",
  original_title: "Interstellar",
  year: 2014,
  age_rating: "12+",
  poster_url: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
  runtime_min: 169,
  overview:
    "Когда засуха, пыльные бури и вымирание растений приводят человечество к продовольственному кризису, группа исследователей отправляется через червоточину в космосе искать планету, пригодную для жизни.",
  genres: [
    { id: 878, name: "фантастика" },
    { id: 18, name: "драма" },
    { id: 12, name: "приключения" },
  ],
  countries: [
    { code: "US", name: "США" },
    { code: "GB", name: "Великобритания" },
  ],
  crew: [
    { person_id: 525, name: "Кристофер Нолан", role: "director" },
    { person_id: 525, name: "Кристофер Нолан", role: "writer" },
    { person_id: 527, name: "Джонатан Нолан", role: "writer" },
    { person_id: 947, name: "Ханс Циммер", role: "composer" },
    { person_id: 556, name: "Эмма Томас", role: "producer" },
  ],
  actors: [
    { person_id: 10297, name: "Мэттью Макконахи", character: "Купер", photo_url: null },
    { person_id: 1813, name: "Энн Хэтэуэй", character: "Амелия Брэнд", photo_url: null },
    { person_id: 83002, name: "Джессика Честейн", character: "Мёрф", photo_url: null },
    { person_id: 3895, name: "Майкл Кейн", character: "Профессор Брэнд", photo_url: null },
  ],
};

export const EMPTY_MOVIE_FIXTURE: MovieCard = {
  movie_id: 1000001,
  title: "Фильм без данных",
  original_title: "Film Without Data",
  year: null,
  age_rating: null,
  poster_url: null,
  runtime_min: null,
  overview: null,
  genres: [],
  countries: [],
  crew: [],
  actors: [],
};

const REVIEW_BODY =
  "Этот фильм оставляет много поводов для размышлений. В нём интересно наблюдать за героями, их решениями и отношениями, которые меняются вместе с историей. Музыка и работа с изображением создают особую атмосферу, а отдельные сцены хочется пересмотреть ещё раз. Не все сюжетные решения кажутся убедительными, но впечатление от просмотра остаётся надолго.";

export const REVIEW_FIXTURES: MovieReview[] = Array.from({ length: 23 }, (_, index) => ({
  review_id: index + 1,
  username: index === 2 ? null : `kinoman_${index + 1}`,
  created_at: new Date(Date.UTC(2026, 9, 1 + index, 8, 30)).toISOString(),
  is_edited: index === 1,
  verdict: (["positive", "neutral", "negative"] as const)[index % 3],
  title:
    index === 2 ? null : ["Кино, к которому хочется вернуться", "Есть о чём подумать", "Ожидал большего"][index % 3],
  body: REVIEW_BODY,
  likes: index < 2 ? 18 : (index * 7) % 19,
  dislikes: index === 0 ? 18 : index === 1 ? 23 : (index * 3) % 11,
}));

const catalog = [
  ...TEXT_FOUND_RESULTS.results,
  ...FOUND_RESULTS.audio.results,
  ...FOUND_RESULTS.image.results,
  ...FOUND_RESULTS.video.results,
];

export const movieCard: MockHandler = async ({ request, storage, delays }) => {
  await wait(delays.jsonMs, request.signal);
  const movieId = Number(request.path.split("/")[2]);
  const scenario = storage.get(MOCK_STORAGE_KEYS.movieScenario);

  if (scenario === "NETWORK_ERROR" || scenario === "TIMEOUT")
    throw new TransportError(scenario === "TIMEOUT" ? "timeout" : "network");
  if (scenario === "MOVIE_UNAVAILABLE")
    return mockResponse(503, {
      code: "MOVIE_UNAVAILABLE",
      message: "Не удалось загрузить информацию о фильме. Попробуйте позже",
      field: null,
    });
  if (scenario === "empty" || movieId === EMPTY_MOVIE_FIXTURE.movie_id)
    return mockResponse(200, { ...EMPTY_MOVIE_FIXTURE, movie_id: movieId });
  if (scenario === "MOVIE_NOT_FOUND")
    return mockResponse(404, { code: "MOVIE_NOT_FOUND", message: "Фильм не найден", field: null });
  if (movieId === MOVIE_FIXTURE.movie_id) return mockResponse(200, MOVIE_FIXTURE);

  const movie =
    catalog.find((entry) => entry.movie_id === movieId) ??
    (movieId >= 900000 && movieId < 900012
      ? TEXT_FOUND_RESULTS.results[(movieId - 900000) % TEXT_FOUND_RESULTS.results.length]
      : null);

  return movie
    ? mockResponse(200, { ...EMPTY_MOVIE_FIXTURE, ...movie, movie_id: movieId, original_title: movie.title })
    : mockResponse(404, { code: "MOVIE_NOT_FOUND", message: "Фильм не найден", field: null });
};

type ReviewSort = NonNullable<NonNullable<ListMovieReviewsData["query"]>["sort"]>;

export const movieReviews: MockHandler = async ({ request, storage, delays }) => {
  await wait(delays.jsonMs, request.signal);
  const url = new URL(request.path, "http://localhost");
  const scenario = storage.get(MOCK_STORAGE_KEYS.reviewScenario);

  if (scenario === "error")
    return mockResponse(500, { code: "INTERNAL_ERROR", message: "Произошла ошибка. Попробуйте позже", field: null });
  if (
    scenario === "empty" ||
    storage.get(MOCK_STORAGE_KEYS.movieScenario) === "empty" ||
    url.pathname.includes("/1000001/")
  )
    return mockResponse(200, { reviews: [], has_more: false });

  const sort = (url.searchParams.get("sort") ?? "best") as ReviewSort;
  const page = Number(url.searchParams.get("page") ?? "1");
  const reviews = [...REVIEW_FIXTURES].sort((a, b) => {
    if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
    if (sort === "newest") return b.created_at.localeCompare(a.created_at);

    const difference = sort === "worst" ? b.dislikes - a.dislikes : b.likes - a.likes;

    return difference || b.created_at.localeCompare(a.created_at);
  });

  return mockResponse(200, {
    reviews: reviews.slice((page - 1) * 10, page * 10),
    has_more: page * 10 < reviews.length,
  });
};
