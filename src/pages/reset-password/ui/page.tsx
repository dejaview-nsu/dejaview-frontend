import { useUnit } from "effector-react";

import { AuthShell } from "@/layouts/auth";

import { NewPasswordForm, ResetLinkCheckFailed, ResetLinkChecking, ResetLinkExpired } from "@/features/reset-password";

import { Panel } from "@/shared/ui";

import { $$resetPassword } from "../model";

export const ResetPasswordPage = () => {
  const screen = useUnit($$resetPassword.outputs.$screen);

  return (
    <AuthShell hero="posters">
      <Panel variant="card">
        {screen === "checking" && <ResetLinkChecking />}
        {screen === "form" && <NewPasswordForm model={$$resetPassword} />}
        {screen === "expired" && <ResetLinkExpired />}
        {screen === "failed" && <ResetLinkCheckFailed model={$$resetPassword} />}
      </Panel>
    </AuthShell>
  );
};
