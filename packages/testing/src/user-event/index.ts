import type * as Gtk from "@gtkx/gi/gtk";
import { click, dblClick, tripleClick } from "./click.js";
import { drag, dragAndDrop, drop, hover, longPress, rotate, swipe, unhover, zoom } from "./gesture.js";
import { keyboard, tab } from "./keyboard.js";
import { type PointerInput, pointer } from "./pointer.js";
import { deselectOptions, selectOptions } from "./selection.js";
import { createInitialState } from "./state.js";
import { clear, copy, cut, paste, type } from "./text.js";

export type { DragOptions, DropContent, DropOptions } from "./gesture.js";
export type { TabOptions } from "./keyboard.js";
export type { PointerInput } from "./pointer.js";
export type { TypeOptions } from "./text.js";
export { resetClipboard } from "./text.js";

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
    keyboard: (widget: Gtk.Widget, input: string) => Promise<void>;
    pointer: (widget: Gtk.Widget, input: PointerInput) => Promise<void>;
};

const state = createInitialState();

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
    keyboard: (widget: Gtk.Widget, input: string): Promise<void> => keyboard(state, widget, input),
    pointer: (widget: Gtk.Widget, input: PointerInput): Promise<void> => pointer(state, widget, input),
};
