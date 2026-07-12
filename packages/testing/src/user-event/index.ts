import type * as Gtk from "@gtkx/gi/gtk";
import { scroll, slide } from "./adjustment.js";
import { click, dblClick, tripleClick } from "./click.js";
import { drag, dragAndDrop, drop, hover, longPress, rotate, swipe, unhover, zoom } from "./gesture.js";
import { keyboard, tab } from "./keyboard.js";
import { type PointerInput, pointer } from "./pointer.js";
import { deselectOptions, selectOptions } from "./selection.js";
import { createInitialState } from "./state.js";
import { clear, copy, cut, paste, type } from "./text.js";

export type { ScrollDelta } from "./adjustment.js";
export type { DragOptions, DropContent, DropOptions } from "./gesture.js";
export type { TabOptions } from "./keyboard.js";
export type { PointerInput } from "./pointer.js";
export type { TypeOptions } from "./text.js";
export { resetClipboard } from "./text.js";

/** The set of user interaction helpers exposed by {@link userEvent}, covering clicks, typing, keyboard, pointer, gestures, selection, and scrolling. */
export type UserEvent = {
    click: typeof click;
    dblClick: typeof dblClick;
    tripleClick: typeof tripleClick;
    tab: typeof tab;
    type: typeof type;
    clear: typeof clear;
    copy: typeof copy;
    cut: typeof cut;
    paste: typeof paste;
    selectOptions: typeof selectOptions;
    deselectOptions: typeof deselectOptions;
    hover: typeof hover;
    unhover: typeof unhover;
    rotate: typeof rotate;
    zoom: typeof zoom;
    swipe: typeof swipe;
    longPress: typeof longPress;
    drag: typeof drag;
    drop: typeof drop;
    dragAndDrop: typeof dragAndDrop;
    slide: typeof slide;
    scroll: typeof scroll;
    keyboard: (widget: Gtk.Widget, input: string) => Promise<void>;
    pointer: (widget: Gtk.Widget, input: PointerInput) => Promise<void>;
};

const state = createInitialState();

/** High-level helpers that simulate user interactions against widgets by dispatching the same events and gestures a real user would trigger. */
export const userEvent: UserEvent = {
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
