import type * as Gtk from "@gtkx/gi/gtk";
import { click, dblClick, tripleClick } from "./click.js";
import {
    type DragOptions,
    type DropContent,
    type DropOptions,
    drag,
    dragAndDrop,
    drop,
    hover,
    longPress,
    rotate,
    swipe,
    unhover,
    zoom,
} from "./gesture.js";
import { keyboardWith, type TabOptions, tab } from "./keyboard.js";
import { type PointerInput, pointerWith } from "./pointer.js";
import { deselectOptions, selectOptions } from "./selection.js";
import { createInitialState, type UserEventState } from "./state.js";
import { clear, copy, cut, paste, type TypeOptions, type } from "./text.js";

export type { DragOptions, DropContent, DropOptions } from "./gesture.js";
export type { TabOptions } from "./keyboard.js";
export type { PointerInput } from "./pointer.js";
export type { TypeOptions } from "./text.js";
export { resetClipboard } from "./text.js";

/**
 * Options for {@link userEvent.setup}, applied as defaults to the returned
 * instance's interactions.
 */
export type UserEventOptions = {
    /** Default for {@link TypeOptions.skipClick} on the instance's `type` */
    skipClick?: boolean;
};

/**
 * Result of {@link userEvent.setup}: the same helpers as {@link userEvent},
 * but with persistent keyboard/pointer state across calls.
 */
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

/**
 * Alias of {@link UserEventInstance}, matching the `UserEvent` type name from
 * `@testing-library/user-event`.
 */
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

/**
 * User interaction utilities for testing.
 *
 * Simulates user actions like clicking, typing, and selecting.
 * All methods are async and wait for GTK event processing.
 *
 * @example
 * ```tsx
 * import { render, screen, userEvent } from "@gtkx/testing";
 *
 * test("form submission", async () => {
 *   await render(<LoginForm />);
 *
 *   const input = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
 *   await userEvent.type(input, "username");
 *
 *   const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
 *   await userEvent.click(button);
 * });
 * ```
 */
export const userEvent: UserEventInstance & {
    /**
     * Creates an isolated user-event instance whose `keyboard` and `pointer`
     * helpers retain modifier and pointer-down state across calls.
     *
     * Mirrors `@testing-library/user-event` v14's `userEvent.setup()`.
     *
     * @example
     * ```tsx
     * const user = userEvent.setup();
     * await user.keyboard("{Shift>}"); // Shift held
     * await user.keyboard("a");        // arrives with Shift still held
     * await user.keyboard("{/Shift}"); // Shift released
     * ```
     */
    setup: (options?: UserEventOptions) => UserEventInstance;
} = {
    ...buildUserEvent(createInitialState()),
    setup: (options?: UserEventOptions): UserEventInstance => buildUserEvent(createInitialState(), options),
};
