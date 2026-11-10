import { useUnit } from "effector-react";

import { AuthShell } from "@/layouts/auth";

import { PasswordResetSent, RequestPasswordResetForm } from "@/features/request-password-reset";

import { Panel } from "@/shared/ui";

import { $$forgotPassword } from "../model";

export const ForgotPasswordPage = () => {
  const sent = useUnit($$forgotPassword.outputs.$isSent);

  return (
    <AuthShell hero="posters">
      <Panel variant="card">
        {sent ? <PasswordResetSent model={$$forgotPassword} /> : <RequestPasswordResetForm model={$$forgotPassword} />}
      </Panel>
    </AuthShell>
  );
};
