import { useUnit } from "effector-react";
import { LogOut, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui";

import { PROFILE_TEXTS } from "../config";
import { $$signOutDialog, comingSoonPressed } from "../model";
import { SignOutDialog } from "./sign-out-dialog";

export const ProfileActions = () => {
  const { openSignOut, showComingSoon } = useUnit({
    openSignOut: $$signOutDialog.inputs.opened,
    showComingSoon: comingSoonPressed,
  });

  return (
    <div className="flex flex-col items-center gap-4 border-t-2 border-dashed border-divider pt-8 md:flex-row md:gap-8 md:pt-10">
      <Button variant="brand-secondary-small" className="w-full max-w-80 md:w-auto" onPress={() => openSignOut()}>
        <LogOut size={20} strokeWidth={1.75} aria-hidden="true" />
        {PROFILE_TEXTS.signOut}
      </Button>
      <Button variant="brand-danger" onPress={() => showComingSoon()}>
        <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
        {PROFILE_TEXTS.deleteProfile}
      </Button>
      <SignOutDialog />
    </div>
  );
};
