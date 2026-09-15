import type * as Gdk from "@gtkx/gi/gdk";
import type * as GLib from "@gtkx/gi/glib";
import type * as Gtk from "@gtkx/gi/gtk";
import { useEffectEvent, useLayoutEffect } from "react";

type SourceResult = typeof GLib.SOURCE_CONTINUE | typeof GLib.SOURCE_REMOVE;
type TickHandler = (widget: Gtk.Widget, frameClock: Gdk.FrameClock) => SourceResult;

function useTickCallback(target: Gtk.Widget | null, callback: TickHandler): void {
    const tick = useEffectEvent(callback);

    useLayoutEffect(() => {
        if (target === null) {
            return;
        }

        let id: number | null = target.addTickCallback((widget, frameClock) => {
            const isKeep = tick(widget, frameClock);
            if (!isKeep) {
                id = null;
            }

            return isKeep;
        });

        return () => {
            if (id !== null) {
                target.removeTickCallback(id);
            }
        };
    }, [target]);
}

export { useTickCallback };
