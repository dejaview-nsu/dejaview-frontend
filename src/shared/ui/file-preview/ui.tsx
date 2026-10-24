import { Image } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "../../lib/cn";

export const FilePreview = ({
  file,
  className,
  onLoaded,
}: {
  file: File;
  className?: string;
  onLoaded?: (file: File) => void;
}) => {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [failedFile, setFailedFile] = useState<File | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview({ file, url });

    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className={cn("aspect-video overflow-hidden rounded-sm border border-border-strong bg-hover", className)}>
      {preview?.file === file && failedFile !== file ? (
        <img
          src={preview.url}
          alt={`Выбранный кадр: ${file.name}`}
          className="h-full w-full object-cover"
          onError={() => setFailedFile(file)}
          onLoad={() => onLoaded?.(file)}
        />
      ) : (
        <div
          role="img"
          aria-label="Предпросмотр недоступен"
          className="flex h-full items-center justify-center text-muted"
        >
          <Image size={32} strokeWidth={1.75} aria-hidden="true" />
        </div>
      )}
    </div>
  );
};
