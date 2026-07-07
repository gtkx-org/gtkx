import type * as Gtk from "@gtkx/gi/gtk";
import { createPortal, useMergeRefs } from "@gtkx/react";
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
import { portalRoot } from "./hooks/use-placed-child.js";

export type DialogInstance = Gtk.Widget & {
    present(parent: Gtk.Widget | null): void;
    forceClose(): void;
};

type DialogElement = ReactElement<{ ref?: Ref<DialogInstance | null> }>;

export type DialogProps = {
    parent?: Gtk.Window | null | undefined;
    children: DialogElement;
};

export const Dialog = ({ parent = null, children }: DialogProps): ReactNode => {
    const [dialog, setDialogState] = useState<DialogInstance | null>(null);
    const setDialog = useCallback<RefCallback<DialogInstance>>((instance) => {
        setDialogState(instance);
    }, []);
    const element = isValidElement(children) ? (children as DialogElement) : null;
    const mergedRef = useMergeRefs<DialogInstance>(setDialog, element?.props.ref);

    useLayoutEffect(() => {
        if (!dialog) return;
        dialog.present(parent);
        return () => dialog.forceClose();
    }, [dialog, parent]);

    if (element === null) return null;
    return createPortal(cloneElement(element, { ref: mergedRef }), portalRoot);
};
