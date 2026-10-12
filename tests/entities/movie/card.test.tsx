import { RouterProvider } from "@effector/router-react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MovieCard } from "@/entities/movie";

import { type MovieSearchResult } from "@/shared/api";
import { router } from "@/shared/routes";

const movie: MovieSearchResult = {
  movie_id: 603,
  title: "Матрица",
  year: null,
  poster_url: null,
  overview: null,
};

const Card = ({ movie }: { movie: MovieSearchResult }) => (
  <RouterProvider router={router}>
    <MovieCard movie={movie} />
  </RouterProvider>
);

describe("movie card", () => {
  it("shows a poster fallback and card link when optional details are missing", () => {
    render(<Card movie={movie} />);

    expect(screen.getByRole("heading", { name: "Матрица" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Нет постера фильма «Матрица»" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Подробнее о фильме «Матрица»" })).toHaveAttribute("href", "/movies/603");
  });

  it("shows the available year and description", () => {
    render(<Card movie={{ ...movie, year: 1999, overview: "Нео узнаёт правду о мире." }} />);

    expect(screen.getByText("1999")).toBeInTheDocument();
    expect(screen.getByText("Нео узнаёт правду о мире.")).toBeInTheDocument();
  });

  it("replaces a broken poster and retries when its URL changes", () => {
    const { rerender } = render(<Card movie={{ ...movie, poster_url: "https://example.com/broken.jpg" }} />);

    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img", { name: "Нет постера фильма «Матрица»" })).toBeInTheDocument();

    rerender(<Card movie={{ ...movie, poster_url: "https://example.com/new.jpg" }} />);
    expect(screen.getByRole("img", { name: "Постер фильма «Матрица»" })).toHaveAttribute(
      "src",
      "https://example.com/new.jpg",
    );
  });
});
