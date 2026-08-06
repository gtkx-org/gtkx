import type * as Adw from "@gtkx/gi/adw";
import { type ElementType, type ReactNode, useCallback } from "react";
import { createPortaledComponent } from "../components/portaled.js";
import { useParentWindow } from "../hooks/use-parent-window.js";
import { createPresentedComponent, type PresentedProps } from "../hooks/use-presented-instance.js";

type DialogComponentProps = PresentedProps<Adw.Dialog>;

const closeDialog = (dialog: Adw.Dialog): void => {
    dialog.forceClose();
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
