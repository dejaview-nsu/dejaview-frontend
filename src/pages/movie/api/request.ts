import { callApi, type ListMovieReviewsData, zMovieCard, zMovieReviewsPage } from "@/shared/api";

export type ReviewSort = NonNullable<NonNullable<ListMovieReviewsData["query"]>["sort"]>;

export const getMovie = (movieId: string) =>
  callApi({ method: "GET", path: `/movies/${movieId}`, schema: zMovieCard, onUnauthorized: "guest" });

export const getReviews = ({ movieId, sort, page }: { movieId: string; sort: ReviewSort; page: number }) =>
  callApi({
    method: "GET",
    path: `/movies/${movieId}/reviews?sort=${sort}&page=${page}`,
    schema: zMovieReviewsPage,
    onUnauthorized: "guest",
  });
