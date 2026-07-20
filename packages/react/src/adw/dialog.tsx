import type * as Adw from "@gtkx/gi/adw";
import { type ElementType, type ReactNode, type Ref, useCallback, useLayoutEffect, useState } from "react";
import { useMergedRef } from "../hooks/use-merged-refs.js";
import { useParentWindow } from "../hooks/use-parent-window.js";
import { createPortal } from "../reconciler/portal.js";
import { rootElement } from "../reconciler/root-element.js";

type DialogComponentProps = {
    ref?: Ref<Adw.Dialog | null> | undefined;
};

export const createDialogComponent = (Component: ElementType): ((props: DialogComponentProps) => ReactNode) => {
    return ({ ref, ...rest }: DialogComponentProps): ReactNode => {
        const parent = useParentWindow();
        const [dialog, setDialog] = useState<Adw.Dialog | null>(null);

        const handleMount = useCallback((instance: Adw.Dialog) => {
            setDialog(instance);

            return () => {
                instance.forceClose();
                setDialog(null);
            };
        }, []);

        useLayoutEffect(() => {
            dialog?.present(parent);
        }, [dialog, parent]);

        const mergedRef = useMergedRef<Adw.Dialog>(ref, handleMount);

        return createPortal(<Component ref={mergedRef} {...rest} />, rootElement);
    };
};
