import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, type Ref, useLayoutEffect, useState } from "react";
import { useMergeRefs } from "../hooks/use-merge-refs.js";
import { createPortal } from "../reconciler/portal.js";
import { createRootElement } from "../reconciler/root-element.js";

const toplevelRoot = createRootElement();

const useWindowPresentation = (): ((window: Gtk.Window | null) => void) => {
    const [toplevel, setToplevel] = useState<Gtk.Window | null>(null);

    useLayoutEffect(() => {
        if (!toplevel) return;
        toplevel.present();
        return () => {
            toplevel.setDefaultWidget(null);
            toplevel.destroy();
        };
    }, [toplevel]);

    return setToplevel;
};

export const withWindowPresentation = <P extends { children?: ReactNode }>(
    Underlying: ElementType,
): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const externalRef = (props as { ref?: Ref<Gtk.Window | null> }).ref;
        const { children, ...rest } = props;
        const capture = useWindowPresentation();
        const ref = useMergeRefs(externalRef, capture);
        return createPortal(
            <Underlying {...rest} ref={ref}>
                {children}
            </Underlying>,
            toplevelRoot,
        );
    };
};
