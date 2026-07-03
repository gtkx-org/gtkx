import * as Gdk from "@gtkx/gi/gdk";
import type * as Gtk from "@gtkx/gi/gtk";
import { type RefObject, useRef } from "react";

export type ContextMenuGesture = {
    ref: RefObject<Gtk.GestureClick | null>;
    onPressed: (nPress: number, x: number, y: number) => void;
    onReleased: (nPress: number, x: number, y: number) => void;
};

export type ContextMenuGestureOptions = {
    onContextMenu: (x: number, y: number) => void;
};

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
