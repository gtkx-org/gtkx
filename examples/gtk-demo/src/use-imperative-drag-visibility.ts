import type * as Gtk from "@gtkx/gi/gtk";
import { type RefObject, useRef } from "react";

export interface ImperativeDragVisibility<T extends Gtk.Widget> {
    ref: RefObject<T | null>;
    show: () => void;
    hide: () => void;
}

export function useImperativeDragVisibility<T extends Gtk.Widget>(): ImperativeDragVisibility<T> {
    const ref = useRef<T | null>(null);

    const show = () => {
        ref.current?.setVisible(true);
    };

    const hide = () => {
        ref.current?.setVisible(false);
    };

    return { ref, show, hide };
}
