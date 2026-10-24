import { cn } from "@/shared/lib/cn";

export const AudioWaveform = ({
  levels,
  progress = 0,
  compact = false,
}: {
  levels: readonly number[];
  progress?: number;
  compact?: boolean;
}) => (
  <div
    aria-hidden="true"
    className={cn("flex min-w-0 flex-1 items-center justify-between gap-0.5 overflow-hidden", compact ? "h-8" : "h-11")}
  >
    {levels.map((level, index) => (
      <span
        key={index}
        className={cn(
          "min-w-px flex-1 rounded-full",
          index / levels.length <= progress ? "bg-brand-brown" : "bg-border-default",
        )}
        style={{ height: `${Math.max(2, level * (compact ? 30 : 42))}px`, maxWidth: compact ? 3 : 4 }}
      />
    ))}
  </div>
);
