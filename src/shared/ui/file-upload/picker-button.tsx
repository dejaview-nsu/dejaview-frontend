import { type ReactNode } from "react";

import { cn } from "../../lib/cn";
import { type ButtonProps, buttonVariants } from "../button";

export const FilePickerButton = ({
  inputId,
  variant,
  className,
  children,
}: {
  inputId: string;
  variant: ButtonProps["variant"];
  className?: string;
  children: ReactNode;
}) => (
  <label
    htmlFor={inputId}
    role="button"
    tabIndex={0}
    className={cn(buttonVariants({ variant }), className)}
    onKeyDown={(event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.currentTarget.control?.click();
    }}
  >
    {children}
  </label>
);
