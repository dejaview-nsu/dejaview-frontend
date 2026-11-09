import { type Route } from "@effector/router";
import { Link } from "@effector/router-react";
import { ArrowLeft } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "../../lib/cn";

export const BackLink = ({ to, className, children }: { to: Route; className?: string; children: ReactNode }) => (
  <Link
    to={to}
    query={{}}
    className={cn(
      "inline-flex min-h-11 items-center justify-center gap-2 self-center text-sm leading-normal font-semibold text-link outline-link hover:underline focus-visible:outline-2",
      className,
    )}
  >
    <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" />
    {children}
  </Link>
);
