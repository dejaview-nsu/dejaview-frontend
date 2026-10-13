import { useUnit } from "effector-react";
import { useId } from "react";

import { MovieSearch, MovieSearchResults } from "@/widgets/movie-search";

import { $$home } from "../model";
import { HomeIntro } from "./home-intro";
import { HowItWorks } from "./how-it-works";

export const HomePage = () => {
  const hasSearchOutput = useUnit($$home.$$search.outputs.$hasSearchOutput);
  const fileInputId = useId();
  return (
    <div className="font-body">
      <HomeIntro />

      <div className="mx-auto w-full px-4 pb-16 md:px-8 md:pb-24 lg:px-12 desktop:px-4">
        <MovieSearch $$model={$$home.$$search} fileInputId={fileInputId} />
        <MovieSearchResults $$model={$$home.$$search} fileInputId={fileInputId} />
        {!hasSearchOutput && <HowItWorks />}
      </div>
    </div>
  );
};
