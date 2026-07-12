import type * as Gtk from "@gtkx/gi/gtk";
import { createPortal, rootElement, useParentWindow } from "@gtkx/react";
import { useMergeRefs } from "@gtkx/react/internal";
import {
    cloneElement,
    isValidElement,
    type ReactElement,
    type ReactNode,
    type Ref,
    type RefCallback,
    useCallback,
    useLayoutEffect,
    useState,
} from "react";

/** A widget that can be presented as a dialog and force-closed, such as an Adw.Dialog. */
export type DialogInstance = Gtk.Widget & {
    /** Presents the dialog, anchored to the given parent widget. */
    present(parent: Gtk.Widget | null): void;
    /** Closes the dialog immediately, bypassing any close confirmation. */
    forceClose(): void;
};

type DialogElement = ReactElement<{ ref?: Ref<DialogInstance | null> }>;

/** Props for {@link Dialog}. */
export type DialogProps = {
    /** Widget to anchor the dialog to, defaulting to the enclosing window when omitted. */
    parent?: Gtk.Window | null | undefined;
    /** The dialog element to present, which must accept a ref to a {@link DialogInstance}. */
    children: DialogElement;
};

/**
 * Presents its single child element as a dialog through a portal, calling present on
 * mount and forceClose on unmount.
 */
export const Dialog = ({ parent, children }: DialogProps): ReactNode => {
    const parentWindow = useParentWindow();
    const resolvedParent = parent === undefined ? parentWindow : parent;
    const [dialog, setDialogState] = useState<DialogInstance | null>(null);
    const setDialog = useCallback<RefCallback<DialogInstance>>((instance) => {
        setDialogState(instance);
    }, []);
    const element = isValidElement(children) ? (children as DialogElement) : null;
    const mergedRef = useMergeRefs<DialogInstance>(setDialog, element?.props.ref);

    useLayoutEffect(() => {
        if (!dialog) return;
        dialog.present(resolvedParent);
        return () => dialog.forceClose();
    }, [dialog, resolvedParent]);

    if (element === null) return null;
    return createPortal(cloneElement(element, { ref: mergedRef }), rootElement);
};
