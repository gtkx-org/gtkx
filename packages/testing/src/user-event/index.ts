import type * as Gtk from "@gtkx/gi/gtk";
import { scroll, slide } from "./adjustment.js";
import { click, dblClick, tripleClick } from "./click.js";
import { drag, dragAndDrop, drop, hover, longPress, rotate, swipe, unhover, zoom } from "./gesture.js";
import { keyboard, tab } from "./keyboard.js";
import { pointer, type PointerInput } from "./pointer.js";
import { deselectOptions, selectOptions } from "./selection.js";
import { createInitialState } from "./state.js";
import { clear, copy, cut, paste, type } from "./text.js";

/**
 * The set of user interaction helpers exposed by {@link userEvent}, covering clicks, typing,
 * keyboard, pointer, gestures, selection, and scrolling.
 */
type UserEvent = {
    /**
     * Clicks a button, toggles a switch, and otherwise activates the widget, falling back to a click
     * gesture on its nearest clickable ancestor when activation does nothing.
     */
    click: typeof click;
    /** Emits a two-press click gesture on the widget. */
    dblClick: typeof dblClick;
    /** Emits a three-press click gesture on the widget. */
    tripleClick: typeof tripleClick;
    /** Moves focus within the widget's root, forward by default and backward with `isShiftHeld`. */
    tab: typeof tab;
    /** Focuses an editable widget, applies any initial selection, and inserts the text at the cursor. */
    type: typeof type;
    /** Empties an editable widget's text. */
    clear: typeof clear;
    /** Writes an editable widget's current selection to the clipboard. */
    copy: typeof copy;
    /** Writes an editable widget's current selection to the clipboard and deletes it. */
    cut: typeof cut;
    /** Inserts the given text, or the clipboard's text, at an editable widget's cursor. */
    paste: typeof paste;
    /** Selects the items at the given positions in a list view, drop-down, combo box, or list box. */
    selectOptions: typeof selectOptions;
    /** Deselects the items at the given positions in a list view or list box. */
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
    /** Applies a pointer token, tracking whether the left button is held across calls. */
    pointer: (widget: Gtk.Widget, input: PointerInput) => Promise<void>;
};

const state = createInitialState();

/**
 * High-level helpers that drive widgets by dispatching the same events and gestures GTK4 delivers
 * when someone clicks, types, or drags.
 */
const userEvent: UserEvent = {
    click,
    dblClick,
    tripleClick,
    tab,
    type,
    clear,
    copy,
    cut,
    paste,
    selectOptions,
    deselectOptions,
    hover,
    unhover,
    rotate,
    zoom,
    swipe,
    longPress,
    drag,
    drop,
    dragAndDrop,
    slide,
    scroll,
    keyboard: (widget: Gtk.Widget, input: string): Promise<void> => keyboard(state, widget, input),
    pointer: (widget: Gtk.Widget, input: PointerInput): Promise<void> => pointer(state, widget, input),
};

export type { ScrollDelta } from "./adjustment.js";
export type { DragOffset, DragOptions, DropContent, DropOptions } from "./gesture.js";
export type { TabOptions } from "./keyboard.js";
export type { PointerInput } from "./pointer.js";
export type { TypeOptions } from "./text.js";
export { resetClipboard } from "./text.js";
export { userEvent, type UserEvent };
