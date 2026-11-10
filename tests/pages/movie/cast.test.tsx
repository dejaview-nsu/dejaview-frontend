import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MovieCast } from "@/pages/movie/ui/movie-cast";

import { MOVIE_FIXTURE } from "@/shared/api/mocks/movies";

describe("movie cast", () => {
  it("renders original and dubbing credits with independent headings and the same cards", () => {
    const actor = MOVIE_FIXTURE.actors[0];
    render(
      <>
        <MovieCast actors={[actor]} />
        <MovieCast title="Актёры дубляжа" actors={[{ ...actor, name: "Актёр дубляжа" }]} />
      </>,
    );

    const original = screen.getByRole("region", { name: "Актёры" });
    const dubbing = screen.getByRole("region", { name: "Актёры дубляжа" });
    expect(within(original).getByText(actor.name)).toBeInTheDocument();
    expect(within(dubbing).getByText("Актёр дубляжа")).toBeInTheDocument();
    expect(within(original).getByText(actor.character!)).toBeInTheDocument();
    expect(within(dubbing).getByText(actor.character!)).toBeInTheDocument();
  });

  it("does not render an empty credits section", () => {
    render(<MovieCast title="Актёры дубляжа" actors={[]} />);

    expect(screen.queryByRole("region", { name: "Актёры дубляжа" })).toBeNull();
  });
});
