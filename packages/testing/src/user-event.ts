import type * as Gtk from "@gtkx/gi/gtk";
import { click, dblClick, tripleClick } from "./click.js";
import { drag, dragAndDrop, drop, hover, longPress, rotate, swipe, unhover, zoom } from "./gesture.js";
import { keyboardWith, tab } from "./keyboard.js";
import { pointerWith } from "./pointer.js";
import { deselectOptions, selectOptions } from "./selection.js";
import { createInitialState, type UserEventState } from "./state.js";
import { clear, copy, cut, paste, type TypeOptions, type } from "./text.js";

export type { DragOptions, DropContent, DropOptions } from "./gesture.js";
export type { TabOptions } from "./keyboard.js";
export type { PointerInput } from "./pointer.js";
export type { TypeOptions } from "./text.js";
export { resetClipboard } from "./text.js";

export type UserEventOptions = {
    skipClick?: boolean;
};

export type UserEventInstance = {
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
    keyboard: ReturnType<typeof keyboardWith>;
    pointer: ReturnType<typeof pointerWith>;
};

export type UserEvent = UserEventInstance;

type StatelessHelpers = Omit<UserEventInstance, "type" | "keyboard" | "pointer">;

const statelessHelpers: StatelessHelpers = {
    click,
    dblClick,
    tripleClick,
    tab,
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
};

const buildUserEvent = (state: UserEventState, options?: UserEventOptions): UserEventInstance => ({
    ...statelessHelpers,
    type: (widget: Gtk.Widget, text: string, typeOptions?: TypeOptions): Promise<void> =>
        type(widget, text, { skipClick: options?.skipClick, ...typeOptions }),
    keyboard: keyboardWith(state),
    pointer: pointerWith(state),
});

export const userEvent: UserEventInstance & {
    setup: (options?: UserEventOptions) => UserEventInstance;
} = {
    ...buildUserEvent(createInitialState()),
    setup: (options?: UserEventOptions): UserEventInstance => buildUserEvent(createInitialState(), options),
};
