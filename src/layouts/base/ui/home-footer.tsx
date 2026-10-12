import { BrandLogo } from "./brand-logo";

export const HomeFooter = () => (
  <footer className="flex h-24 items-center bg-header px-4 text-on-dark md:h-[140px] md:px-12">
    <div className="mx-auto flex w-full max-w-results items-center justify-between gap-6">
      <BrandLogo />
      <span className="w-[211px] shrink-0 text-center whitespace-nowrap font-label text-sm leading-[1.2] font-semibold tracking-widest uppercase">
        Найди то, что почти забыл
      </span>
    </div>
  </footer>
);
