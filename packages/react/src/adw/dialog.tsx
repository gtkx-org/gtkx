import type * as Adw from "@gtkx/gi/adw";
import { type ElementType, type ReactNode, type Ref, use, useLayoutEffect, useState } from "react";
import { useMergedRef } from "../hooks/use-merged-refs.js";
import { ParentWindowContext } from "../hooks/use-parent-window.js";
import { rootElement } from "../reconciler/root-element.js";
import { createPortal } from "../reconciler/root.js";

type DialogComponentProps = {
    ref?: Ref<Adw.Dialog | null> | undefined;
};

const createDialogComponent = (Component: ElementType): ((props: DialogComponentProps) => ReactNode) => {
    return ({ ref, ...rest }: DialogComponentProps): ReactNode => {
        const parent = use(ParentWindowContext);
        const [dialog, setDialog] = useState<Adw.Dialog | null>(null);

        useLayoutEffect(() => {
            if (!dialog) {
                return;
            }

            dialog.present(parent);

            return () => {
                dialog.forceClose();
            };
        }, [dialog, parent]);

        const mergedRef = useMergedRef(ref, setDialog);

        return createPortal(<Component ref={mergedRef} {...rest} />, rootElement);
    };
};

export { createDialogComponent };
