import { Link } from "@effector/router-react";
import { Link2Off } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { routes } from "@/shared/routes";
import { BackLink, buttonVariants } from "@/shared/ui";

import { RESET_PASSWORD_TEXTS as TEXTS } from "../config";
import { ScreenHeading } from "./screen-heading";

export const ResetLinkExpired = () => (
  <section aria-labelledby="reset-link-expired-title" className="flex flex-col items-center text-center font-body">
    <ScreenHeading id="reset-link-expired-title" icon={Link2Off} align="center">
      {TEXTS.expiredTitle}
    </ScreenHeading>
    <div className="mt-4 text-base leading-normal text-ink">
      <p>{TEXTS.expiredLifetime}</p>
      <p>{TEXTS.expiredAction}</p>
    </div>
    <div className="mt-4 flex w-full flex-col items-center gap-2 border-t border-dashed border-divider pt-4">
      <Link
        to={routes.forgotPassword}
        query={{}}
        className={cn(buttonVariants({ variant: "brand" }), "tracking-[1.5px]")}
      >
        {TEXTS.requestAgain}
      </Link>
      <BackLink to={routes.login}>{TEXTS.backToLogin}</BackLink>
    </div>
  </section>
);
