import { CircleAlert, CircleCheck } from "lucide-react";
import { type ReactNode, type Ref } from "react";

import { cn } from "../../lib/cn";

export const Alert = ({
  tone,
  children,
  alertRef,
  className,
}: {
  tone: "error" | "success";
  children: ReactNode;
  alertRef?: Ref<HTMLDivElement>;
  className?: string;
}) => {
  const Icon = tone === "success" ? CircleCheck : CircleAlert;

  return (
    <div
      ref={alertRef}
      role={tone === "error" ? "alert" : "status"}
      tabIndex={-1}
      className={cn(
        "flex scroll-mt-6 items-center gap-2.5 border-2 px-3 py-3.5 text-sm leading-normal outline-link focus-visible:outline-2",
        tone === "success"
          ? "border-success-text bg-success-bg text-success-text"
          : "border-error-text bg-error-bg text-error-text",
        className,
      )}
    >
      <Icon className="shrink-0" size={24} strokeWidth={1.75} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
};
