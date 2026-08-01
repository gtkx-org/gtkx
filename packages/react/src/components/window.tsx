import type * as Gtk from "@gtkx/gi/gtk";
import { type ElementType, type ReactNode, type Ref, useLayoutEffect, useState } from "react";
import { useMergedRef } from "../hooks/use-merged-refs.js";
import { ParentWindowContext } from "../hooks/use-parent-window.js";
import { applyWrite } from "../reconciler/signals.js";

type WindowComponentProps = {
    ref?: Ref<Gtk.Window | null> | undefined;
};

const presentWindow = (window: Gtk.Window): void => {
    applyWrite(() => {
        window.present();
    });
};

const destroyWindow = (window: Gtk.Window): void => {
    applyWrite(() => {
        window.destroy();
    });
};

const createWindowComponent = (Component: ElementType): ((props: WindowComponentProps) => ReactNode) => {
    return ({ ref, ...rest }: WindowComponentProps): ReactNode => {
        const [window, setWindow] = useState<Gtk.Window | null>(null);
        const mergedRef = useMergedRef(ref, setWindow);

        useLayoutEffect(() => {
            if (!window) {
                return;
            }

            presentWindow(window);

            return () => {
                destroyWindow(window);
            };
        }, [window]);

        return (
            <ParentWindowContext.Provider value={window}>
                <Component ref={mergedRef} {...rest} />
            </ParentWindowContext.Provider>
        );
    };
};

export { createWindowComponent };
