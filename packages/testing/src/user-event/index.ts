import type * as Gtk from "@gtkx/gi/gtk";
import { delay } from "../timers.js";
import { scroll, slide } from "./adjustment.js";
import { click, dblClick, tripleClick } from "./click.js";
import { drag, dragAndDrop, drop, hover, longPress, rotate, swipe, unhover, zoom } from "./gesture.js";
import { keyboard, tab } from "./keyboard.js";
import { pointer, type PointerInput } from "./pointer.js";
import { deselectOptions, selectOptions } from "./selection.js";
import { createInitialState, type UserEventState } from "./state.js";
import { clear, copy, cut, paste, type } from "./text.js";

/** Options shared by every helper on a {@link UserEvent} instance. */
type UserEventOptions = {
    /** Milliseconds to wait after each helper resolves; null, the default, waits not at all. */
    delay?: number | null | undefined;
};

/** User interactions exposed by {@link userEvent}. */
type UserEvent = {
    /** Creates an instance with shared keyboard and pointer state. */
    setup: (options?: UserEventOptions) => UserEvent;
    /** Activates or presses and releases a widget. */
    click: typeof click;
    /** Delivers a double-click gesture. */
    dblClick: typeof dblClick;
    /** Delivers a triple-click gesture. */
    tripleClick: typeof tripleClick;
    /** Moves focus forward or backward within the root. */
    tab: typeof tab;
    /** Types into an editable widget. */
    type: typeof type;
    /** Deletes all text from an editable widget. */
    clear: typeof clear;
    /** Copies the current selection. */
    copy: typeof copy;
    /** Cuts the current selection. */
    cut: typeof cut;
    /** Pastes text or clipboard contents. */
    paste: typeof paste;
    /** Selects positions without activating them. */
    selectOptions: typeof selectOptions;
    /** Unselects positions without activating them. */
    deselectOptions: typeof deselectOptions;
    /** Emits a motion `enter` on the widget, adding a motion controller when it has none. */
    hover: typeof hover;
    /** Emits a motion `leave` on the widget, adding a motion controller when it has none. */
    unhover: typeof unhover;
    /** Emits `angle-changed` on the widget's rotate gestures. */
    rotate: typeof rotate;
    /** Emits `scale-changed` on the widget's zoom gestures. */
    zoom: typeof zoom;
    /** Emits `swipe` with the given velocity on the widget's swipe gestures. */
    swipe: typeof swipe;
    /** Emits `pressed` at the given point on the widget's long-press gestures. */
    longPress: typeof longPress;
    /** Runs a begin, update, and end sequence on the widget's drag gestures, ending at the given offset. */
    drag: typeof drag;
    /** Emits `drop` with the given content on the widget's drop targets. */
    drop: typeof drop;
    /** Requires a drag source on the source widget, then emits `drop` with the content on the target's drop targets. */
    dragAndDrop: typeof dragAndDrop;
    /** Emits a jump `change-value` on a Gtk.Range so it moves to the given value. */
    slide: typeof slide;
    /** Adds the delta to the adjustments of the widget itself, or of its nearest scrollable ancestor. */
    scroll: typeof scroll;
    /** Sends a key sequence through GTK's propagation chain. */
    keyboard: (widget: Gtk.Widget, input: string) => Promise<void>;
    /** Applies a pointer token while preserving held-button state. */
    pointer: (widget: Gtk.Widget, input: PointerInput) => Promise<void>;
};

/** User interactions that dispatch GTK events and gestures. */
const userEvent: UserEvent = {
    ...createInstance(createInitialState(), {}),
    setup: (options?: UserEventOptions): UserEvent => createInstance(createInitialState(), options ?? {}),
};

const settle = (ms: number | null | undefined): Promise<void> => {
    if (ms === null || ms === undefined) {
        return Promise.resolve();
    }

    return delay(ms);
};

function createInstance(state: UserEventState, options: UserEventOptions): UserEvent {
    const after =
        <Args extends unknown[]>(helper: (...args: Args) => Promise<void>) =>
            async (...args: Args): Promise<void> => {
                await helper(...args);
                await settle(options.delay);
            };

    return {
        setup: (overrides?: UserEventOptions): UserEvent => createInstance(state, { ...options, ...overrides }),
        click: after(click),
        dblClick: after(dblClick),
        tripleClick: after(tripleClick),
        tab: after(tab),
        type: after(type),
        clear: after(clear),
        copy: after(copy),
        cut: after(cut),
        paste: after(paste),
        selectOptions: after(selectOptions),
        deselectOptions: after(deselectOptions),
        hover: after(hover),
        unhover: after(unhover),
        rotate: after(rotate),
        zoom: after(zoom),
        swipe: after(swipe),
        longPress: after(longPress),
        drag: after(drag),
        drop: after(drop),
        dragAndDrop: after(dragAndDrop),
        slide: after(slide),
        scroll: after(scroll),
        keyboard: after((widget: Gtk.Widget, input: string): Promise<void> => keyboard(state, widget, input)),
        pointer: after((widget: Gtk.Widget, input: PointerInput): Promise<void> => pointer(state, widget, input)),
    };
}

export type { ScrollDelta } from "./adjustment.js";
export type { DragOffset, DragOptions, DropContent, DropOptions } from "./gesture.js";
export type { TabOptions } from "./keyboard.js";
export type { PointerInput } from "./pointer.js";
export type { TypeOptions } from "./text.js";
export { resetClipboard } from "./text.js";
export { userEvent, type UserEvent, type UserEventOptions };
