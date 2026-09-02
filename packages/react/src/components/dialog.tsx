import type * as Adw from "@gtkx/gi/adw";
import { type ElementType, type ReactNode, useCallback } from "react";
import { useParentWindow } from "../hooks/use-parent-window.js";
import { createPresentedComponent, type PresentedProps } from "../hooks/use-presented-instance.js";
import { applyMutation } from "../reconciler/signals.js";
import { createPortaledComponent } from "./portaled.js";

type DialogComponentProps = PresentedProps<Adw.Dialog>;

const closeDialog = (dialog: Adw.Dialog): void => {
    applyMutation(() => {
        dialog.forceClose();
    });
};

const usePresentDialog = (): ((dialog: Adw.Dialog) => void) => {
    const parent = useParentWindow();

    return useCallback(
        (dialog: Adw.Dialog) => {
            dialog.present(parent);
        },
        [parent],
    );
};

const createDialogComponent = (Component: ElementType): ((props: DialogComponentProps) => ReactNode) =>
    createPortaledComponent(
        createPresentedComponent<Adw.Dialog>(Component, {
            usePresent: usePresentDialog,
            dismiss: closeDialog,
        }),
    );

/** @internal */
export { createDialogComponent };
