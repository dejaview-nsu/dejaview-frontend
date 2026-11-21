export const ListMovieCardSkeleton = () => (
  <div aria-hidden="true" className="flex min-w-0 flex-col gap-2 motion-safe:animate-pulse">
    <div className="aspect-[2/3] w-full bg-disabled-bg" />
    <div className="h-5 w-4/5 bg-disabled-bg" />
    <div className="h-3.5 w-full bg-disabled-bg" />
    <div className="h-3.5 w-full bg-disabled-bg" />
    <div className="mt-1 h-10 w-full bg-disabled-bg" />
  </div>
);
