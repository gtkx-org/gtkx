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

export type DialogInstance = Gtk.Widget & {
    present(parent: Gtk.Widget | null): void;
    forceClose(): void;
};

type DialogElement = ReactElement<{ ref?: Ref<DialogInstance | null> }>;

export type DialogProps = {
    parent?: Gtk.Window | null | undefined;
    children: DialogElement;
};

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
