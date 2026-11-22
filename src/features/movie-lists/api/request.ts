import { callApi, type ListTypePath, type UnauthorizedPolicy, zNoContent, zUserMovieState } from "@/shared/api";

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
  onUnauthorized = "guest",
}: {
  movieId: string;
  list: ListTypePath;
  selected: boolean;
  onUnauthorized?: UnauthorizedPolicy;
}) =>
  callApi({
    method: selected ? "PUT" : "DELETE",
    path: `/users/me/lists/${list}/${movieId}`,
    schema: zNoContent,
    onUnauthorized,
  });
