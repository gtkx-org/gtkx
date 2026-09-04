import type * as Gtk from "@gtkx/gi/gtk";
import { delay } from "../timers.js";
import { requireWidget } from "../widget-target.js";
import { scroll, slide } from "./adjustment.js";
import { click, dblClick, tripleClick } from "./click.js";
import {
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
    click: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof click> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Delivers a double-click gesture. */
    dblClick: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof dblClick> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Delivers a triple-click gesture. */
    tripleClick: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof tripleClick> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Moves focus forward or backward within the root. */
    tab: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof tab> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Types into an editable widget. */
    type: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof type> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Deletes all text from an editable widget. */
    clear: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof clear> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Copies the current selection. */
    copy: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof copy> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Cuts the current selection. */
    cut: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof cut> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Pastes text or clipboard contents. */
    paste: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof paste> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Selects positions without activating them. */
    selectOptions: typeof selectOptions;
    /** Unselects positions without activating them. */
    deselectOptions: typeof deselectOptions;
    /** Emits a motion `enter` on the widget, adding a motion controller when it has none. */
    hover: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof hover> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Emits a motion `leave` on the widget, adding a motion controller when it has none. */
    unhover: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof unhover> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Emits `angle-changed` on the widget's rotate gestures. */
    rotate: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof rotate> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Emits `scale-changed` on the widget's zoom gestures. */
    zoom: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof zoom> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Emits `swipe` with the given velocity on the widget's swipe gestures. */
    swipe: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof swipe> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Emits `pressed` at the given point on the widget's long-press gestures. */
    longPress: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof longPress> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Runs a begin, update, and end sequence on the widget's drag gestures, ending at the given offset. */
    drag: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof drag> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Emits `drop` with the given content on the widget's drop targets. */
    drop: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof drop> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Requires a drag source on the source widget, then emits `drop` with the content on the target's drop targets. */
    dragAndDrop: (
        source: Gtk.Accessible,
        target: Gtk.Accessible,
        ...args: Parameters<typeof dragAndDrop> extends [Gtk.Widget, Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Emits a jump `change-value` on a Gtk.Range so it moves to the given value. */
    slide: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof slide> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Adds the delta to the adjustments of the widget itself, or of its nearest scrollable ancestor. */
    scroll: (
        widget: Gtk.Accessible,
        ...args: Parameters<typeof scroll> extends [Gtk.Widget, ...infer Args] ? Args : never
    ) => Promise<void>;
    /** Sends a key sequence through GTK's propagation chain. */
    keyboard: (widget: Gtk.Accessible, input: string) => Promise<void>;
    /** Applies a pointer token while preserving held-button state. */
    pointer: (widget: Gtk.Accessible, input: PointerInput) => Promise<void>;
};

const onWidget =
    <Args extends unknown[]>(helper: (widget: Gtk.Widget, ...args: Args) => Promise<void>) =>
        (target: Gtk.Accessible, ...args: Args): Promise<void> =>
            helper(requireWidget(target), ...args);

const onWidgetPair =
    <Args extends unknown[]>(helper: (source: Gtk.Widget, target: Gtk.Widget, ...args: Args) => Promise<void>) =>
        (source: Gtk.Accessible, target: Gtk.Accessible, ...args: Args): Promise<void> =>
            helper(requireWidget(source), requireWidget(target), ...args);

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
        click: after(onWidget(click)),
        dblClick: after(onWidget(dblClick)),
        tripleClick: after(onWidget(tripleClick)),
        tab: after(onWidget(tab)),
        type: after(onWidget(type)),
        clear: after(onWidget(clear)),
        copy: after(onWidget(copy)),
        cut: after(onWidget(cut)),
        paste: after(onWidget(paste)),
        selectOptions: after(onWidget(selectOptions)),
        deselectOptions: after(onWidget(deselectOptions)),
        hover: after(onWidget(hover)),
        unhover: after(onWidget(unhover)),
        rotate: after(onWidget(rotate)),
        zoom: after(onWidget(zoom)),
        swipe: after(onWidget(swipe)),
        longPress: after(onWidget(longPress)),
        drag: after(onWidget(drag)),
        drop: after(onWidget(drop)),
        dragAndDrop: after(onWidgetPair(dragAndDrop)),
        slide: after(onWidget(slide)),
        scroll: after(onWidget(scroll)),
        keyboard: after(
            onWidget((widget: Gtk.Widget, input: string): Promise<void> => keyboard(state, widget, input)),
        ),
        pointer: after(
            onWidget((widget: Gtk.Widget, input: PointerInput): Promise<void> => pointer(state, widget, input)),
        ),
    };
}

export type { ScrollDelta } from "./adjustment.js";
export type { DragOffset, DragOptions, DropContent, DropOptions } from "./gesture.js";
export type { TabOptions } from "./keyboard.js";
export type { PointerInput } from "./pointer.js";
export type { TypeOptions } from "./text.js";
export { resetClipboard } from "./text.js";
export { userEvent, type UserEvent, type UserEventOptions };
