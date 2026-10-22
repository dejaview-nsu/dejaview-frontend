import { useUnit } from "effector-react";

import { AuthShell } from "@/layouts/auth";

import { CheckEmail } from "@/features/resend-confirmation";

import { Panel } from "@/shared/ui";

import { $$registerForm, $$resendConfirmation } from "../model";
import { RegisterForm } from "./register-form";

export const RegisterPage = () => {
  const confirmation = useUnit($$registerForm.outputs.$confirmation);

  if (confirmation) {
    return (
      <AuthShell>
        <Panel>
          <CheckEmail model={$$resendConfirmation} email={confirmation.email} />
        </Panel>
      </AuthShell>
    );
  }

  return (
    <AuthShell withBenefits>
      <Panel variant="form">
        <RegisterForm />
      </Panel>
    </AuthShell>
  );
};
