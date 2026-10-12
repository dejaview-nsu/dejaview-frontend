import { useUnit } from "effector-react";

import { Button } from "@/shared/ui/button";

import { useMovieSearchModel } from "../model";
import { SearchButton } from "./search-button";

export const SearchActions = () => {
  const $$model = useMovieSearchModel();
  const { pending, isStub, search, cancel } = useUnit({
    pending: $$model.outputs.$pending,
    isStub: $$model.outputs.$isStubMode,
    search: $$model.inputs.searchPressed,
    cancel: $$model.inputs.searchCancelled,
  });

  return (
    <div className="mt-4 flex flex-col items-center gap-3 p-2.5 md:mt-[22px]">
      <SearchButton pending={pending} isDisabled={isStub} onPress={search} />
      {pending && (
        <Button variant="brand-ghost" onPress={cancel}>
          Отменить поиск
        </Button>
      )}
    </div>
  );
};
