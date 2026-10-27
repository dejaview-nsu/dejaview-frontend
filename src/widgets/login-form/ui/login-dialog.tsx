import { useUnit } from "effector-react";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";

import { $$session } from "@/entities/session";

import { $$loginDialog } from "../model/dialog";
import { LoginForm } from "./login-form";

export const LoginDialog = () => {
  const { opened, path, pending, dismiss } = useUnit({
    opened: $$session.outputs.$isLoginDialogOpened,
    path: $$session.outputs.$loginDialogPath,
    pending: $$loginDialog.outputs.$pending,
    dismiss: $$session.inputs.loginDialogDismissed,
  });

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Disabling the submit button can move focus to body, where the dialog cannot handle Escape.
    if (pending) dialogRef.current?.focus({ preventScroll: true });
  }, [pending]);

  return (
    <ModalOverlay
      isOpen={opened}
      isDismissable
      onOpenChange={(isOpen) => {
        if (!isOpen) dismiss();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-header/60 font-body md:px-6 md:py-25"
    >
      <Modal className="min-h-dvh w-full bg-card text-ink outline-none md:min-h-0 md:max-w-110 md:border-2 md:border-border-strong md:shadow-hard-xl">
        <Dialog ref={dialogRef} className="relative outline-none">
          <div className="flex h-14 items-center justify-between bg-header pl-2.5 pr-1 text-on-dark md:absolute md:top-[35.5px] md:right-8 md:h-11 md:bg-transparent md:p-0 md:text-ink">
            <span aria-hidden="true" className="font-heading text-[26px]/[1.1] font-black text-brand-gold md:hidden">
              DV
            </span>
            <Button
              aria-label="Закрыть окно входа"
              onPress={() => dismiss()}
              className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center outline-link hover:opacity-70"
            >
              <X className="md:hidden" size={32} strokeWidth={1.75} aria-hidden="true" />
              <X className="hidden md:block" size={24} strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>
          <div className="flex flex-col gap-4.5 px-12 pt-12 pb-12 md:p-8">
            <div className="flex items-center justify-center p-2.5 md:justify-between">
              <Heading
                slot="title"
                className="text-center font-heading text-mobile-heading-2 font-extrabold text-black md:text-[28px]/[1.1] md:text-left"
              >
                Вход в DejaView
              </Heading>
            </div>
            <LoginForm model={$$loginDialog} id="login-dialog" registerPath={path} />
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
