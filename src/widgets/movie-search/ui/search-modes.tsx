import { AlignLeft, Image, LockKeyhole, Mic, Video } from "lucide-react";
import { Tab, TabList } from "react-aria-components";

import { searchModes } from "../config/search";

const modeIcons = { text: AlignLeft, image: Image, video: Video, audio: Mic };

export const SearchModes = ({ authenticated }: { authenticated: boolean }) => (
  <TabList
    aria-label="Режим поиска"
    className="grid grid-cols-2 gap-3 border-2 border-border-strong bg-hover p-2.5 lg:grid-cols-4"
  >
    {searchModes.map(({ id, label, hint }) => {
      const Icon = modeIcons[id];
      return (
        <Tab
          id={id}
          key={id}
          className="group relative flex h-[84px] min-w-0 cursor-pointer flex-col justify-center gap-1.5 border-2 border-border-strong p-3 outline-offset-4 hover:bg-disabled-bg focus-visible:outline-2 focus-visible:outline-link data-[selected]:bg-brand-brown data-[selected]:text-brand-gold data-[selected]:shadow-hard lg:h-auto lg:min-h-28 lg:gap-1 lg:px-4 xl:h-28"
          aria-label={label + (!authenticated && id !== "text" ? ", после входа" : "")}
        >
          <Icon className="shrink-0" size={id === "text" ? 28 : 24} strokeWidth={1.75} aria-hidden="true" />
          {!authenticated && id !== "text" && (
            <span className="absolute top-4 right-2.5 flex items-center gap-1 font-label text-sm leading-[1.2] font-semibold tracking-widest text-terracotta-text uppercase">
              <LockKeyhole size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden xl:inline">После входа</span>
            </span>
          )}
          <span className="whitespace-nowrap font-heading text-base leading-[1.25] font-bold lg:text-card-title">
            {label}
          </span>
          <span className="hidden text-sm leading-[1.5] text-muted group-data-[selected]:text-on-dark lg:block">
            {hint}
          </span>
        </Tab>
      );
    })}
  </TabList>
);
