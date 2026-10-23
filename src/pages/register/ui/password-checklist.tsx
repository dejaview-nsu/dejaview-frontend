import { Circle, CircleCheck, CircleX } from "lucide-react";

import { type PasswordRuleState } from "@/features/register";

import { cn } from "@/shared/lib/cn";

const stateIcons = { neutral: Circle, passed: CircleCheck, failed: CircleX };

const stateLabels = { neutral: " — не выполнено", passed: " — выполнено", failed: " — не выполнено" };

export const PasswordChecklist = ({
  checks,
}: {
  checks: { id: string; label: string; state: PasswordRuleState }[];
}) => (
  <ul aria-label="Требования к паролю" className="flex flex-col gap-1.5 text-sm leading-normal">
    {checks.map(({ id, label, state }) => {
      const Icon = stateIcons[state];

      return (
        <li
          key={id}
          data-state={state}
          className={cn(
            "flex items-center gap-2",
            state === "neutral" && "text-muted",
            state === "passed" && "text-success-text",
            state === "failed" && "text-error-text",
          )}
        >
          <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>
            {label}
            <span className="sr-only">{stateLabels[state]}</span>
          </span>
        </li>
      );
    })}
  </ul>
);
