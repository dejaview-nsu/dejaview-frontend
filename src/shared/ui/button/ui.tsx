import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps } from "react";
import { Button as AriaButton } from "react-aria-components";

import { cn } from "../../lib/cn";

const defaultStyle =
  "rounded-lg px-4 py-2 text-sm font-medium focus-visible:ring-system-primary focus-visible:ring-offset-surface-base disabled:opacity-50";
const brandStyle =
  "gap-2.5 rounded-none font-label font-semibold uppercase tracking-widest focus-visible:ring-link focus-visible:ring-offset-card";

const button = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-default",
  {
    variants: {
      variant: {
        primary: `${defaultStyle} bg-system-primary text-white hover:bg-system-primary-hover`,
        secondary: `${defaultStyle} border border-border-base bg-surface-base text-text-base hover:bg-surface-page`,
        ghost: `${defaultStyle} text-text-base hover:bg-surface-page`,
        brand: `${brandStyle} h-12 border-2 border-border-strong bg-brand-brown px-6 text-[15px]/none text-brand-gold shadow-hard hover:bg-button-hover active:bg-button-pressed active:shadow-pressed disabled:bg-disabled-bg disabled:text-disabled-text disabled:shadow-none disabled:opacity-100`,
        "brand-loading": `${brandStyle} h-12 border-2 border-border-strong bg-brand-brown px-6 text-[15px]/none text-brand-gold shadow-hard`,
        "brand-secondary": `${brandStyle} min-h-12 border-2 border-border-strong bg-card px-6 text-[15px]/none text-ink hover:bg-hover disabled:opacity-50`,
        "brand-ghost": `${brandStyle} min-h-11 px-4 py-2 text-sm disabled:opacity-50 text-ink hover:bg-page`,
        "brand-danger": `${brandStyle} min-h-11 px-4 py-2 text-sm disabled:opacity-50 text-error-text hover:bg-error-bg`,
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
