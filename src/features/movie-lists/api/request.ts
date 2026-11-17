import { callApi, type ListTypePath, zNoContent, zUserMovieState } from "@/shared/api";

export const getMovieLists = (movieId: string) =>
  callApi({
    method: "GET",
    path: `/users/me/movies/${movieId}`,
    schema: zUserMovieState,
    onUnauthorized: "guest",
  });

export const changeMovieList = ({
  movieId,
  list,
  selected,
}: {
  movieId: string;
  list: ListTypePath;
  selected: boolean;
}) =>
  callApi({
    method: selected ? "PUT" : "DELETE",
    path: `/users/me/lists/${list}/${movieId}`,
    schema: zNoContent,
    onUnauthorized: "guest",
  });
