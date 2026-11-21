import { callApi, type ListTypePath, type ListUserMoviesData, zUserListPage, zUserProfile } from "@/shared/api";

export type ListSort = NonNullable<NonNullable<ListUserMoviesData["query"]>["sort"]>;

export type ListQuery = { list: ListTypePath; sort: ListSort; q: string; page: number };

export const getProfile = () => callApi({ method: "GET", path: "/users/me", schema: zUserProfile });

export const getListMovies = ({ list, sort, q, page }: ListQuery) => {
  const search = new URLSearchParams({ sort, page: String(page) });

  if (q) search.set("q", q);

  return callApi({ method: "GET", path: `/users/me/lists/${list}?${search}`, schema: zUserListPage });
};
