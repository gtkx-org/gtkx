import type * as Adw from "@gtkx/gi/adw";
import { type ElementType, type ReactNode, useCallback } from "react";
import { useParentWindow } from "../hooks/use-parent-window.js";
import { createPresentedComponent, type PresentedProps } from "../hooks/use-presented-instance.js";
import { rootElement } from "../reconciler/root-element.js";
import { createPortal } from "../reconciler/root.js";

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
    createPresentedComponent<Adw.Dialog>(Component, {
        usePresent: usePresentDialog,
        dismiss: closeDialog,
        wrap: (element) => createPortal(element, rootElement),
    });

/** @internal */
export { createDialogComponent };
