import type * as Gtk from "@gtkx/gi/gtk";
import { type RefObject, useLayoutEffect, useRef } from "react";

/**
 * A tick source accepted by {@link useTickCallback}: the widget itself, a
 * React ref holding it (such as a `ref` to a JSX widget), or
 * `null`/`undefined` to keep the hook inactive.
 */
export type TickTarget = Gtk.Widget | RefObject<Gtk.Widget | null> | null | undefined;

interface TickRegistration {
    readonly widget: Gtk.Widget;
    id: number | null;
}

const isWidget = (target: Gtk.Widget | RefObject<Gtk.Widget | null>): target is Gtk.Widget =>
    typeof (target as Gtk.Widget).addTickCallback === "function";

const resolveTarget = (target: TickTarget): Gtk.Widget | null => {
    if (!target) return null;
    if (isWidget(target)) return target;
    return target.current;
};

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
export function useTickCallback(target: TickTarget, callback: Gtk.TickCallback): void {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    const registrationRef = useRef<TickRegistration | null>(null);

    useLayoutEffect(() => {
        const widget = resolveTarget(target);
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
