import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, type Ref, useLayoutEffect, useState } from "react";
import { useMergeRefs } from "../hooks/use-merge-refs.js";
import { ParentWindowContext } from "../hooks/use-parent-window.js";

export const createWindowComponent = <P extends { children?: ReactNode }>(
    Component: ElementType,
): ((props: P) => ReactNode) => {
    return (props: P): ReactNode => {
        const externalRef = (props as { ref?: Ref<Gtk.Window | null> }).ref;
        const [window, setWindow] = useState<Gtk.Window | null>(null);
        const ref = useMergeRefs(externalRef, setWindow);

        useLayoutEffect(() => {
            if (!window) return;
            window.present();
            return () => {
                window.setDefaultWidget(null);
                window.destroy();
            };
        }, [window]);

        return (
            <ParentWindowContext.Provider value={window}>
                <Component {...props} ref={ref} />
            </ParentWindowContext.Provider>
        );
    };
};
