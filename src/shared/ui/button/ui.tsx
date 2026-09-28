import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps } from "react";
import { Button as AriaButton } from "react-aria-components";

import { cn } from "@/shared/lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-system-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-system-primary text-white hover:bg-system-primary-hover",
        secondary: "border border-border-base bg-surface-base text-text-base hover:bg-surface-page",
        ghost: "text-text-base hover:bg-surface-page",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export type ButtonProps = ComponentProps<typeof AriaButton> & VariantProps<typeof button>;

export const Button = ({ className, variant, ...props }: ButtonProps) => {
  return <AriaButton className={cn(button({ variant }), className)} {...props} />;
};
