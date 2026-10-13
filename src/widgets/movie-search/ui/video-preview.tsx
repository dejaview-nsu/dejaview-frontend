import { Play } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/shared/lib/cn";

const BYTES_IN_MEGABYTE = 1024 * 1024;

const megabytes = new Intl.NumberFormat("ru", { maximumFractionDigits: 1 });

export const formatMegabytes = (bytes: number) => megabytes.format(bytes / BYTES_IN_MEGABYTE);

export const formatDuration = (seconds: number) => {
  const total = Math.floor(seconds);

  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export const VideoPreview = ({
  file,
  durationSeconds,
  size = "small",
  className,
}: {
  file: File;
  durationSeconds: number | null;
  size?: "small" | "large";
  className?: string;
}) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);

    return () => URL.revokeObjectURL(next);
  }, [file]);

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-sm border border-border-strong bg-header",
        className,
      )}
    >
      {url && (
        <video src={url} preload="metadata" muted playsInline aria-hidden="true" className="size-full object-cover" />
      )}

      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 m-auto flex items-center justify-center rounded-full bg-header/70 text-on-dark",
          size === "small" ? "size-10" : "size-16",
        )}
      >
        <Play size={size === "small" ? 20 : 32} strokeWidth={1.75} className="fill-current" />
      </span>

      {durationSeconds !== null && (
        <span
          className={cn(
            "absolute right-2 bottom-2 rounded-sm bg-header/80 font-label leading-none font-semibold tracking-widest text-on-dark",
            size === "small" ? "px-1.5 py-1 text-sm" : "px-3 py-2 text-card-title",
          )}
        >
          {formatDuration(durationSeconds)}
        </span>
      )}
    </div>
  );
};
