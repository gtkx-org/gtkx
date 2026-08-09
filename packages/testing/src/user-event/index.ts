import type * as Gtk from "@gtkx/gi/gtk";
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

/**
 * The set of user interaction helpers exposed by {@link userEvent}, covering clicks, typing,
 * keyboard, pointer, gestures, selection, and scrolling.
 */
type UserEvent = {
    /**
     * Returns a fresh instance whose helpers share one keyboard and pointer state, so held modifiers
     * and buttons carry across its calls but not across instances.
     */
    setup: (options?: UserEventOptions) => UserEvent;
    /**
     * Activates a widget that neither claims the click nor carries a click gesture of its own, and
     * otherwise presses and releases outwards from the clicked widget through every widget carrying
     * a click gesture, stopping at the first button or indexed child. A list box row or flow box
     * child receives its click gesture at the clicked position, passes one on to the gestures its
     * container carries, and is then activated, or exclusively selected when its container does not
     * activate on a single click.
     */
    click: typeof click;
    /**
     * Delivers a two-press click gesture along the same path a single click takes, without trying
     * activation first, activating a list box row or flow box child on that path and replacing its
     * container's selection whether or not that container activates on a single click.
     */
    dblClick: typeof dblClick;
    /**
     * Delivers a three-press click gesture the same way a double click is delivered, applying the
     * same outcome to a list box row or flow box child.
     */
    tripleClick: typeof tripleClick;
    /** Moves focus within the widget's root, forward by default and backward with `isShiftHeld`. */
    tab: typeof tab;
    /** Focuses an editable widget, applies any initial selection, and inserts the text at the cursor. */
    type: typeof type;
    /** Focuses an editable widget and deletes its whole text, leaving nothing selected. */
    clear: typeof clear;
    /** Writes an editable widget's current selection to the clipboard. */
    copy: typeof copy;
    /** Writes an editable widget's current selection to the clipboard and deletes it. */
    cut: typeof cut;
    /** Inserts the given text, or the clipboard's text, at an editable widget's cursor. */
    paste: typeof paste;
    /**
     * Selects the items at those positions in a view or drop-down, or selects the indexed children of
     * a list box or flow box through their container, without activating them.
     */
    selectOptions: typeof selectOptions;
    /** Unselects the items at those positions, leaving list box and flow box children unactivated. */
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
    /** Sends a key sequence, dispatching matching shortcuts and tracking held modifiers across calls. */
    keyboard: (widget: Gtk.Widget, input: string) => Promise<void>;
    /**
     * Applies a pointer token to the click gestures the widget already carries, tracking whether the
     * left button is held across calls.
     */
    pointer: (widget: Gtk.Widget, input: PointerInput) => Promise<void>;
};

/**
 * High-level helpers that drive widgets by dispatching the same events and gestures GTK4 delivers
 * when someone clicks, types, or drags. Call `setup` for an instance with its own keyboard and
 * pointer state.
 */
const userEvent: UserEvent = {
    ...createInstance(createInitialState(), {}),
    setup: (options?: UserEventOptions): UserEvent => createInstance(createInitialState(), options ?? {}),
};

const settle = (delay: number | null | undefined): Promise<void> => {
    if (delay === null || delay === undefined) {
        return Promise.resolve();
    }

    return new Promise((resolve) => setTimeout(resolve, delay));
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
