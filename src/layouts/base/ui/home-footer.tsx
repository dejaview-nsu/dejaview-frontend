import { cn } from "@/shared/lib/cn";

import { BrandLogo } from "./brand-logo";

export const HomeFooter = ({ mobileHidden = false }: { mobileHidden?: boolean }) => (
  <footer
    className={cn(
      "h-24 items-center bg-header px-4 text-on-dark md:h-[140px] md:px-12",
      mobileHidden ? "hidden md:flex" : "flex",
    )}
  >
    <div className="mx-auto flex w-full max-w-results items-center justify-between gap-6">
      <BrandLogo />
      <span className="w-[211px] shrink-0 text-center whitespace-nowrap font-label text-sm leading-[1.2] font-semibold tracking-widest uppercase">
        Найди то, что почти забыл
      </span>
    </div>
  </footer>
);
