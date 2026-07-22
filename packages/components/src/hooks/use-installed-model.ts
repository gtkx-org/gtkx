import type * as Gtk from "@gtkx/gi/gtk";
import { type RefObject, useLayoutEffect, useRef } from "react";

export const useInstalledModel = <W extends Gtk.Widget, M>(
    object: RefObject<W | null>,
    model: M,
    install: (widget: W, model: M) => void,
): void => {
    const installRef = useRef(install);
    installRef.current = install;

    useLayoutEffect(() => {
        const widget = object.current;
        if (widget === null) return;
        installRef.current(widget, model);
    }, [object, model]);
};
