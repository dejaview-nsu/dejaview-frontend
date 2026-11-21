import { useUnit } from "effector-react";

import { ConfirmDialog } from "@/shared/ui";

import { PROFILE_TEXTS } from "../config";
import { $$signOutDialog } from "../model";

const TEXTS = PROFILE_TEXTS.signOutDialog;

export const SignOutDialog = () => {
  const { isOpen, error, pending, dismiss, confirm } = useUnit({
    isOpen: $$signOutDialog.outputs.$isOpen,
    error: $$signOutDialog.outputs.$error,
    pending: $$signOutDialog.outputs.$pending,
    dismiss: $$signOutDialog.inputs.dismissed,
    confirm: $$signOutDialog.inputs.confirmed,
  });

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={TEXTS.title}
      cancelLabel={TEXTS.cancel}
      confirmLabel={TEXTS.confirm}
      closeLabel={TEXTS.close}
      pending={pending}
      error={error}
      onCancel={() => dismiss()}
      onConfirm={() => confirm()}
    >
      <p>{TEXTS.text}</p>
    </ConfirmDialog>
  );
};
