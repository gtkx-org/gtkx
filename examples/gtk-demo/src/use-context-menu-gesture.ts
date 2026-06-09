import * as Gdk from "@gtkx/gi/gdk";
import type * as Gtk from "@gtkx/gi/gtk";
import { type RefObject, useRef } from "react";

/**
 * Wires a `GtkGestureClick` to fire `onContextMenu` on both the pointer and
 * touch context-menu paths:
 * - pointer/keyboard: `GdkEvent.triggersContextMenu()` on the press
 * - touch: `GDK_TOUCH_END` event type on the release
 *
 * Mirrors the dual-path setup used by the official `gtk-demo` C reference
 * (e.g. `pressed_cb` + `released_cb` in `dnd.c`).
 */
export interface ContextMenuGesture {
    ref: RefObject<Gtk.GestureClick | null>;
    onPressed: (nPress: number, x: number, y: number) => void;
    onReleased: (nPress: number, x: number, y: number) => void;
}

export interface ContextMenuGestureOptions {
    /**
     * Invoked when a context menu should appear at `(x, y)` in the gesture
     * widget's coordinate space. Triggered for pointer right-click,
     * keyboard menu key, and touch-end.
     */
    onContextMenu: (x: number, y: number) => void;
}

/**
 * Builds the ref + handlers needed by a `<GtkGestureClick button={0}>`
 * controller so the gesture fires `options.onContextMenu` for both pointer
 * and touch context-menu activation paths.
 *
 * @example
 * ```tsx
 * const ctx = useContextMenuGesture({ onContextMenu: showMenu });
 * <GtkGestureClick
 *   ref={ctx.ref}
 *   button={0}
 *   onPressed={ctx.onPressed}
 *   onReleased={ctx.onReleased}
 * />
 * ```
 */
export function useContextMenuGesture(options: ContextMenuGestureOptions): ContextMenuGesture {
    const ref = useRef<Gtk.GestureClick | null>(null);
    const { onContextMenu } = options;

    const onPressed = (_nPress: number, x: number, y: number) => {
        const event = ref.current?.getCurrentEvent();
        if (event?.triggersContextMenu()) onContextMenu(x, y);
    };

    const onReleased = (_nPress: number, x: number, y: number) => {
        const event = ref.current?.getCurrentEvent();
        if (event?.getEventType() === Gdk.EventType.TOUCH_END) onContextMenu(x, y);
    };

    return { ref, onPressed, onReleased };
}
