import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, type Ref, useLayoutEffect, useState } from "react";
import { useMergeRefs } from "../hooks/use-merge-refs.js";
import { ParentWindowContext } from "../hooks/use-parent-window.js";

const useWindowPresentation = (): [Gtk.Window | null, (window: Gtk.Window | null) => void] => {
    const [toplevel, setToplevel] = useState<Gtk.Window | null>(null);

    useLayoutEffect(() => {
        if (!toplevel) return;
        toplevel.present();
        return () => {
            toplevel.setDefaultWidget(null);
            toplevel.destroy();
        };
    }, [toplevel]);

    return [toplevel, setToplevel];
};

export const withWindowPresentation = <P extends { children?: ReactNode }>(
    Underlying: ElementType,
): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const externalRef = (props as { ref?: Ref<Gtk.Window | null> }).ref;
        const { children, ...rest } = props;
        const [toplevel, capture] = useWindowPresentation();
        const ref = useMergeRefs(externalRef, capture);
        return (
            <Underlying {...rest} ref={ref}>
                <ParentWindowContext.Provider value={toplevel}>{children}</ParentWindowContext.Provider>
            </Underlying>
        );
    };
};
