import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { AudioWaveform } from "./audio-waveform";
import { formatDuration, formatMegabytes } from "./video-preview";

const audioSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${new Intl.NumberFormat("ru", { maximumFractionDigits: 1 }).format(bytes / 1024)} КБ`
    : `${formatMegabytes(bytes)} МБ`;
const recordedDate = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const silence = Array.from({ length: 80 }, () => 0);

export const AudioPreview = ({
  file,
  durationSeconds = null,
  compact = false,
  disabled = false,
}: {
  file: File;
  durationSeconds?: number | null;
  compact?: boolean;
  disabled?: boolean;
}) => {
  const audio = useRef<HTMLAudioElement>(null);
  const title =
    file.name === "Запись с микрофона.wav" ? `Запись · ${recordedDate.format(file.lastModified)}` : file.name;
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [waveform, setWaveform] = useState<{ file: File; levels: number[] } | null>(null);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const levels = waveform?.file === file ? waveform.levels : silence;
  const bars = compact ? levels.filter((_, index) => index % 3 === 0) : levels;
  const total = durationSeconds ?? duration;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    let active = true;
    setPreview({ file, url });
    setTime(0);
    setPlaying(false);
    setError(null);
    setDuration(durationSeconds ?? 0);

    const readWaveform = async () => {
      if (typeof AudioContext === "undefined" || typeof file.arrayBuffer !== "function") return;
      const context = new AudioContext();
      try {
        const buffer = await context.decodeAudioData(await file.arrayBuffer());
        const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
          buffer.getChannelData(channel),
        );
        const peaks = Array.from({ length: 80 }, (_, index) => {
          const start = Math.floor((index * buffer.length) / 80);
          const end = Math.floor(((index + 1) * buffer.length) / 80);
          let peak = 0;
          for (const channel of channels)
            for (let sample = start; sample < end; sample++) peak = Math.max(peak, Math.abs(channel[sample]));
          return peak;
        });
        const max = Math.max(...peaks, 0.001);
        if (active) {
          setWaveform({ file, levels: peaks.map((peak) => peak / max) });
          setDuration(buffer.duration);
        }
      } catch {
        // The native player can support formats that Web Audio cannot decode.
      } finally {
        await context.close();
      }
    };
    void readWaveform();
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [file, durationSeconds]);

  useEffect(() => {
    if (disabled && audio.current && !audio.current.paused) audio.current.pause();
  }, [disabled]);

  const toggle = async () => {
    const element = audio.current;
    if (!element) return;
    if (!element.paused) {
      element.pause();
      return;
    }
    try {
      await element.play();
      setError(null);
    } catch {
      setError("Не удалось воспроизвести фрагмент. Попробуйте другой файл или запишите звук заново.");
    }
  };

  return (
    <div className={cn("min-w-0", compact ? "border border-border-default bg-input p-3" : "p-4 md:p-1")}>
      {!compact && (
        <div className="mb-4 flex min-w-0 flex-col gap-1 md:mb-7 md:flex-row md:items-start md:justify-between md:gap-6">
          <p className="min-w-0 break-words text-sm md:text-base">{title}</p>
          <div className="flex shrink-0 justify-between gap-2 text-xs text-muted md:text-sm">
            <p>
              {file.name.split(".").at(-1)?.toUpperCase()}
              <span className="hidden md:inline"> · {formatDuration(total)} · </span>
              <span className="md:hidden"> </span>
              {audioSize(file.size)}
            </p>
            <span className="tabular-nums md:hidden">
              {formatDuration(time)} / {formatDuration(total)}
            </span>
          </div>
        </div>
      )}
      {preview?.file === file && (
        <audio
          ref={audio}
          preload="metadata"
          src={preview.url}
          aria-label={`Прослушать ${file.name}`}
          className="sr-only"
          onLoadedMetadata={(event) => {
            if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        />
      )}
      <div className={cn("flex items-center gap-3", !compact && "md:gap-6")}>
        <Button
          variant={null}
          aria-label={playing ? "Приостановить фрагмент" : "Воспроизвести фрагмент"}
          isDisabled={disabled}
          onPress={() => void toggle()}
          className={cn(
            "size-11 shrink-0 rounded-none bg-header p-0 text-brand-gold hover:bg-brand-brown",
            compact && "size-9",
          )}
        >
          {playing ? (
            <Pause size={22} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Play size={22} strokeWidth={1.75} aria-hidden="true" />
          )}
        </Button>
        <div className="relative flex min-w-0 flex-1 items-center focus-within:outline-2 focus-within:outline-link">
          <AudioWaveform levels={bars} compact={compact} progress={total > 0 ? time / total : 0} />
          <input
            aria-label={`Позиция воспроизведения ${file.name}`}
            type="range"
            min={0}
            max={total || 1}
            step={0.1}
            value={Math.min(time, total || 1)}
            disabled={disabled}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (audio.current) audio.current.currentTime = value;
              setTime(value);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <span className={cn("shrink-0 text-sm tabular-nums text-muted", !compact && "hidden md:inline")}>
          {compact ? formatDuration(total) : `${formatDuration(time)} / ${formatDuration(total)}`}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-error-text">
          {error}
        </p>
      )}
    </div>
  );
};
