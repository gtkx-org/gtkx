import type * as Gtk from "@gtkx/gi/gtk";
import { type RefObject, useLayoutEffect, useRef } from "react";
import { type GObjectTarget, resolveGObjectTarget } from "./gobject-target.js";

interface TickRegistration {
    readonly widget: Gtk.Widget;
    id: number | null;
}

const dropRegistration = (registrationRef: RefObject<TickRegistration | null>): void => {
    const registration = registrationRef.current;
    if (registration) {
        if (registration.id !== null) registration.widget.removeTickCallback(registration.id);
        registrationRef.current = null;
    }
};

/**
 * Registers a frame-clock tick callback on a widget via `addTickCallback` and
 * removes it automatically on unmount or when the target widget changes.
 *
 * The callback fires once per frame while the widget is mapped, receiving the
 * widget and its `Gdk.FrameClock`; returning `true` keeps the tick running and
 * returning `false` stops it, matching GTK's `GtkTickCallback` contract. The
 * latest callback is read on each tick, so changing it never re-registers the
 * tick. The target may be a React ref to a JSX widget; the registration
 * follows the ref, reattaching when a later commit replaces the widget. When
 * the target is or resolves to `null`/`undefined`, the hook is inactive.
 *
 * @param target - The widget to drive, a ref holding it, or null/undefined to disable
 * @param callback - The per-frame callback; return `true` to continue ticking
 *
 * @example
 * ```tsx
 * const areaRef = useRef<Gtk.DrawingArea | null>(null);
 * useTickCallback(areaRef, (widget, frameClock) => {
 *     setAngle(frameClock.getFrameTime() / 1_000_000);
 *     widget.queueDraw();
 *     return true;
 * });
 * ```
 */
export function useTickCallback(target: GObjectTarget<Gtk.Widget>, callback: Gtk.TickCallback): void {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    const registrationRef = useRef<TickRegistration | null>(null);

    useLayoutEffect(() => {
        const widget = resolveGObjectTarget(target);
        const registration = registrationRef.current;
        if (registration && registration.widget === widget) return;
        dropRegistration(registrationRef);
        if (!widget) return;
        const entry: TickRegistration = { widget, id: null };
        entry.id = widget.addTickCallback((tickWidget, frameClock) => {
            const keep = callbackRef.current(tickWidget, frameClock);
            if (!keep) {
                entry.id = null;
                if (registrationRef.current === entry) registrationRef.current = null;
            }
            return keep;
        });
        registrationRef.current = entry;
    });

    useLayoutEffect(() => () => dropRegistration(registrationRef), []);
}
