import type * as Gtk from "@gtkx/gi/gtk";
import { useRef } from "react";
import type { GObjectTarget } from "../utils/gobject-target.js";
import { useTargetRegistration } from "../utils/use-target-registration.js";

interface TickRegistration {
    widget: Gtk.Widget;
    id: number | null;
}

export function useTickCallback(target: GObjectTarget<Gtk.Widget>, callback: Gtk.TickCallback): void {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useTargetRegistration<Gtk.Widget, TickRegistration>(target, {
        attach: (widget, clearIfCurrent) => {
            const entry: TickRegistration = { widget, id: null };
            entry.id = widget.addTickCallback((tickWidget, frameClock) => {
                const keep = callbackRef.current(tickWidget, frameClock);
                if (!keep) {
                    entry.id = null;
                    clearIfCurrent(entry);
                }
                return keep;
            });
            return entry;
        },
        detach: (registration) => {
            if (registration.id !== null) registration.widget.removeTickCallback(registration.id);
        },
        isSame: (registration, widget) => registration.widget === widget,
    });
}
