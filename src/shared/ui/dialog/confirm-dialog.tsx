import { LoaderCircle, X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { Button as AriaButton, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";

import { Alert } from "../alert";
import { Button } from "../button";

export const ConfirmDialog = ({
  isOpen,
  title,
  children,
  cancelLabel,
  confirmLabel,
  closeLabel,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  closeLabel: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pending) dialogRef.current?.focus({ preventScroll: true });
  }, [pending]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      isDismissable={!pending}
      isKeyboardDismissDisabled={pending}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-header/60 px-4 pt-34 pb-8 font-body md:px-6 md:pt-43"
    >
      <Modal className="w-full max-w-110 border-2 border-border-strong bg-card text-ink shadow-hard-xl outline-none">
        <Dialog ref={dialogRef} role="alertdialog" className="flex flex-col gap-6 p-6 outline-none md:p-8">
          <div className="flex items-center justify-between gap-4">
            <Heading slot="title" className="font-heading text-mobile-heading-2 font-extrabold md:text-[28px]/[1.1]">
              {title}
            </Heading>
            <AriaButton
              aria-label={closeLabel}
              isDisabled={pending}
              onPress={onCancel}
              className="-mr-3 flex min-h-11 min-w-11 cursor-pointer items-center justify-center outline-link hover:opacity-70 disabled:cursor-default disabled:opacity-50"
            >
              <X size={24} strokeWidth={1.75} aria-hidden="true" />
            </AriaButton>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <div className="text-center text-base leading-normal">{children}</div>

          <div className="grid grid-cols-2 gap-4">
            <Button variant="brand-secondary" isDisabled={pending} onPress={onCancel}>
              {cancelLabel}
            </Button>
            <Button variant={pending ? "brand-loading" : "brand"} isDisabled={pending} onPress={onConfirm}>
              {pending && (
                <LoaderCircle className="motion-safe:animate-spin" size={20} strokeWidth={1.75} aria-hidden="true" />
              )}
              {confirmLabel}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
