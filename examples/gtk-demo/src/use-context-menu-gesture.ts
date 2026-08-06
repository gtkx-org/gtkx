import type * as Gtk from "@gtkx/gi/gtk";
import * as Gdk from "@gtkx/gi/gdk";
import { type RefObject, useRef } from "react";

type ContextMenuGesture = {
    ref: RefObject<Gtk.GestureClick | null>;
    onPressed: (nPress: number, x: number, y: number) => void;
    onReleased: (nPress: number, x: number, y: number) => void;
};

type ContextMenuGestureOptions = {
    onContextMenu: (x: number, y: number) => void;
};

function useContextMenuGesture(options: ContextMenuGestureOptions): ContextMenuGesture {
    const ref = useRef<Gtk.GestureClick | null>(null);
    const { onContextMenu } = options;

    const notifyWhenEventMatches = (x: number, y: number, isMatching: (event: Gdk.Event) => boolean) => {
        const event = ref.current?.getCurrentEvent();

        if (event && isMatching(event)) {
            onContextMenu(x, y);
        }
    };

    const onPressed = (_nPress: number, x: number, y: number) => {
        notifyWhenEventMatches(x, y, (event) => event.triggersContextMenu());
    };

    const onReleased = (_nPress: number, x: number, y: number) => {
        notifyWhenEventMatches(x, y, (event) => event.getEventType() === Gdk.EventType.TOUCH_END);
    };

    return { ref, onPressed, onReleased };
}

export { useContextMenuGesture };
