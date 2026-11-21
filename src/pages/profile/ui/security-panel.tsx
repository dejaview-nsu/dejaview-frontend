import { ChangePasswordSection } from "@/features/change-password";

import { PROFILE_TEXTS } from "../config";
import { $$changePassword } from "../model";

export const SecurityPanel = () => (
  <section aria-labelledby="profile-security-title" className="flex flex-col gap-5">
    <h2 id="profile-security-title" className="font-heading text-mobile-heading-3 font-bold md:text-heading-3">
      {PROFILE_TEXTS.securityTitle}
    </h2>
    <ChangePasswordSection model={$$changePassword} />
  </section>
);
