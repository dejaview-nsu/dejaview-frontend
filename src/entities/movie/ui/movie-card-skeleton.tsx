export const MovieCardSkeleton = () => (
  <div
    aria-hidden="true"
    className="flex min-w-0 flex-col gap-3 border-2 border-border-strong bg-card p-2 motion-safe:animate-pulse md:p-4"
  >
    <div className="mx-auto aspect-[2/3] w-full max-w-[200px] rounded-sm bg-hover" />
    <div className="flex flex-col gap-3">
      <div className="h-5 w-[70%] bg-hover" />
      <div className="h-3.5 w-1/2 bg-hover" />
      <div className="h-3.5 w-[90%] bg-hover" />
      <div className="h-3.5 w-4/5 bg-hover" />
      <div className="h-3.5 w-2/5 bg-hover" />
    </div>
  </div>
);
