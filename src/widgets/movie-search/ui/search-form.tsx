import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { LockKeyhole } from "lucide-react";
import { TabPanel, Tabs } from "react-aria-components";

import { routes } from "@/shared/routes";

import { type SearchMode } from "../config/search";
import { useMovieSearchModel } from "../model";
import { SearchActions } from "./search-actions";
import { SearchInput } from "./search-input";
import { SearchModes } from "./search-modes";

export const MovieSearchForm = ({ fileInputId }: { fileInputId: string }) => {
  const $$model = useMovieSearchModel();
  const { mode, authenticated, selectMode } = useUnit({
    mode: $$model.outputs.$mode,
    authenticated: $$model.outputs.$isAuthenticated,
    selectMode: $$model.inputs.modeSelected,
  });

  return (
    <>
      <p className="mb-4 font-label text-sm leading-[1.2] font-semibold tracking-widest text-terracotta-text uppercase md:mb-[22px]">
        Шаг 1: выбери, что помнишь
      </p>
      <Tabs selectedKey={mode} onSelectionChange={(key) => selectMode(key as SearchMode)}>
        <SearchModes authenticated={authenticated} />
        <TabPanel
          key={mode}
          id={mode}
          className="mt-4 border-t border-dashed border-divider pt-4 focus-visible:outline-2 focus-visible:outline-link md:mt-[22px] md:pt-[22px]"
        >
          <SearchInput fileInputId={fileInputId} />
          <SearchActions />
        </TabPanel>
      </Tabs>
      {!authenticated && (
        <p className="mx-2.5 mt-2.5 flex items-center gap-1.5 text-sm leading-[1.5] text-muted md:mx-0 md:mt-[22px]">
          <LockKeyhole className="shrink-0" size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="min-w-0">Поиск по кадру, видео и звуку будет доступен после входа.</span>
          <Link to={routes.login} query={{ redirect: "/" }} className="shrink-0 text-link underline underline-offset-3">
            Войти.
          </Link>
        </p>
      )}
    </>
  );
};
