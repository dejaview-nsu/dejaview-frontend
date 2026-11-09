import { type LucideIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

import { cn } from "@/shared/lib/cn";
import { IconTile } from "@/shared/ui";

export const ScreenHeading = ({
  id,
  icon: Icon,
  align,
  children,
}: {
  id: string;
  icon: LucideIcon;
  align: "start" | "center";
  children: ReactNode;
}) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <IconTile>
        <Icon size={32} strokeWidth={1.75} />
      </IconTile>
      <h1
        id={id}
        ref={headingRef}
        tabIndex={-1}
        className={cn(
          "font-heading text-mobile-heading-2 font-extrabold text-black outline-link focus-visible:outline-2 md:text-heading-2",
          align === "start" ? "mt-4" : "mt-5 text-center",
        )}
      >
        {children}
      </h1>
    </>
  );
};
