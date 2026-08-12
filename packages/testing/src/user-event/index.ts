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
     * activate on a single click. The press also stops at a widget whose click GTK4 implements
     * itself, where the gestures that widget carries of its own still take the press and the same
     * outcome is then applied through GTK's own public action: a list, grid, or column-view row is
     * focused and selected, and activated as well when its view activates on a single click; an
     * expandable tree expander that is itself the clicked widget toggles its expansion; a notebook
     * tab, clicked directly or through its label, focuses its notebook and switches to its page; a
     * column header sorts by its column. A column-view cell and the row carrying the column headers
     * stand in the way of the click rather than taking it, so a click on either reaches the row or
     * the view behind it.
     */
    click: typeof click;
    /**
     * Delivers a two-press click gesture along the same path a single click takes, without trying
     * activation first, activating a list box row or flow box child on that path and replacing its
     * container's selection whether or not that container activates on a single click. A widget
     * whose click GTK4 implements itself receives that outcome once per press, so a row is selected
     * and activated by the second press, a tree expander ends back where it started, a notebook tab
     * stays on the page the first press opened, and a column header inverts its order after sorting.
     */
    dblClick: typeof dblClick;
    /**
     * Delivers a three-press click gesture the same way a double click is delivered, applying the
     * same outcome to a list box row or flow box child, and applying the outcome GTK4 implements
     * itself once per press to a row, tree expander, notebook tab, or column header.
     */
    tripleClick: typeof tripleClick;
    /** Moves focus within the widget's root, forward by default and backward with `isShiftHeld`. */
    tab: typeof tab;
    /**
     * Focuses an editable widget the way clicking into it does, leaving its text unselected, applies
     * any initial selection, and inserts the text at the cursor, deleting the text the widget has
     * selected first, the way GTK4 does.
     */
    type: typeof type;
    /** Focuses an editable widget and deletes its whole text, leaving nothing selected. */
    clear: typeof clear;
    /** Writes an editable widget's current selection to the clipboard. */
    copy: typeof copy;
    /** Writes an editable widget's current selection to the clipboard and deletes it. */
    cut: typeof cut;
    /**
     * Inserts the given text, or the clipboard's text, at an editable widget's cursor, deleting the
     * text the widget has selected first, the way GTK4 does.
     */
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
    /**
     * Sends a key sequence along the chain GTK4 propagates a key event through: the application's
     * accelerators first, then the capture-phase controllers from the root down to the event widget,
     * the event widget's target-phase controllers, and the bubble-phase controllers from it back up
     * to the root, so a key controller or shortcut controller a container or window above the widget
     * carries receives the key too, each in the phase it declares. The event widget is the editable
     * delegate GTK4 focuses when the widget has one, the `Gtk.Text` inside a `Gtk.Entry` for
     * instance, so the delegate stands ahead of the widget in the chain. A shortcut controller whose
     * scope is not local runs where it registered instead, the root for a global one and the nearest
     * `Gtk.ShortcutManager` for a managed one, so it fires wherever focus sits inside that subtree
     * and never at its own widget, while a shortcut whose widget is insensitive or unmapped stays
     * inert wherever it sits. The first controller that handles a press ends the chain, and a
     * `Gdk.KEY_Return` press none of them handled reaches an editable widget's activate handler.
     * Built-in key bindings take part, since GTK4 carries them on a shortcut controller: a
     * `Gtk.Text`'s arrow keys or a `Gtk.TextView`'s undo can consume a press before an ancestor
     * sees it. Key controllers GTK4 attaches itself are the exception, since they read a GDK event
     * that off-screen synthesis cannot produce, so only the key controllers the tree connected a
     * `key-pressed` or `key-released` handler to take part. Held modifiers carry across calls.
     */
    keyboard: (widget: Gtk.Widget, input: string) => Promise<void>;
    /**
     * Applies a pointer token to the click gestures the widget already carries, tracking whether the
     * left button is held across calls. On a widget whose click GTK4 implements itself, the release
     * also applies GTK's own outcome, the way {@link UserEvent.click} does, and a column-view cell
     * or the row carrying the column headers passes the token to the row or view behind it.
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
