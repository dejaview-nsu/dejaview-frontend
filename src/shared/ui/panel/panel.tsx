import { type ReactNode } from "react";

import { cn } from "../../lib/cn";

export const Panel = ({
  variant = "panel",
  className,
  children,
}: {
  variant?: "form" | "panel" | "card";
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "relative w-full bg-card",
      variant === "form" && "desktop:border-2 desktop:border-border-strong desktop:p-8 desktop:shadow-hard-xl",
      variant === "panel" && "border-2 border-border-strong p-6 shadow-hard-xl md:p-10",
      variant === "card" && "border-2 border-border-strong p-8 shadow-hard-xl",
      className,
    )}
  >
    {children}
  </div>
);

export const IconTile = ({ children }: { children: ReactNode }) => (
  <span className="flex size-18 shrink-0 items-center justify-center bg-header text-brand-gold" aria-hidden="true">
    {children}
  </span>
);
