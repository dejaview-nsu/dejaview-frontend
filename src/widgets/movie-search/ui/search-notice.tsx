import { CircleAlert, type LucideIcon, TriangleAlert } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { FilePickerButton } from "@/shared/ui/file-upload";

type NoticeAction = { onAction: () => void; fileInputId?: never } | { fileInputId: string; onAction?: never };

export const SearchNotice = ({
  tone,
  title,
  message,
  actionLabel,
  ActionIcon,
  ...action
}: {
  tone: "error" | "warning";
  title: string;
  message: string;
  actionLabel: string;
  ActionIcon?: LucideIcon;
} & NoticeAction) => {
  const Icon = tone === "error" ? CircleAlert : TriangleAlert;
  const actionContent = (
    <>
      {ActionIcon && <ActionIcon size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />}
      {actionLabel}
    </>
  );

  return (
    <div
      role="alert"
      className={cn(
        "mx-auto flex max-w-content flex-col gap-4 border p-4 md:flex-row md:items-center md:gap-8 md:px-8 md:py-6",
        tone === "error" ? "border-error-text bg-error-bg" : "border-warning-text bg-warning-bg",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4 md:items-center md:gap-6">
        <Icon
          className={cn("mt-0.5 shrink-0 md:mt-0", tone === "error" ? "text-error-text" : "text-warning-text")}
          size={28}
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2
            className={cn(
              "font-heading text-mobile-heading-3 font-bold md:text-heading-3",
              tone === "error" ? "text-error-text" : "text-warning-text",
            )}
          >
            {title}
          </h2>
          <p
            className={cn(
              "mt-1 text-base leading-[1.55] break-words",
              tone === "error" ? "text-error-text" : "text-ink",
            )}
          >
            {message}
          </p>
        </div>
      </div>

      {action.fileInputId === undefined ? (
        <Button variant="brand-secondary" className="shrink-0 self-center px-4" onPress={action.onAction}>
          {actionContent}
        </Button>
      ) : (
        <FilePickerButton inputId={action.fileInputId} variant="brand-secondary" className="shrink-0 self-center px-4">
          {actionContent}
        </FilePickerButton>
      )}
    </div>
  );
};
