import type * as Gtk from "@gtkx/ffi/gtk";
import { type RefObject, useCallback, useRef } from "react";

/**
 * Imperatively toggles the visibility of an ancillary widget across a drag
 * lifecycle, sidestepping React's render cycle on drag-begin / drag-end.
 *
 * React-state-driven show/hide does not always rerender before the next GTK
 * frame, so ancillary drag UI (drop zones, trash icons, ghost previews) can
 * miss the drag window entirely. Hold a ref on the widget that should appear
 * during a drag, wire `show` / `hide` to the drag-source signals, and the
 * widget toggles synchronously inside the signal handler.
 *
 * @typeParam T - Widget type the ref targets. Defaults to `Gtk.Widget`.
 *
 * @example
 * ```tsx
 * const trash = useImperativeDragVisibility<Gtk.Box>();
 *
 * <GtkBox ref={trash.ref} visible={false}>{...trash UI...}</GtkBox>
 * <GtkDragSource onDragBegin={trash.show} onDragEnd={trash.hide} />
 * ```
 */
export interface ImperativeDragVisibility<T extends Gtk.Widget> {
    ref: RefObject<T | null>;
    show: () => void;
    hide: () => void;
}

export function useImperativeDragVisibility<T extends Gtk.Widget>(): ImperativeDragVisibility<T> {
    const ref = useRef<T | null>(null);

    const show = useCallback(() => {
        ref.current?.setVisible(true);
    }, []);

    const hide = useCallback(() => {
        ref.current?.setVisible(false);
    }, []);

    return { ref, show, hide };
}
