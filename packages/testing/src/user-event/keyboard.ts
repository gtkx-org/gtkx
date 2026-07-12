import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { getEditableDelegate } from "../editable.js";
import { fireEvent } from "../fire-event.js";
import { dispatchOnOrCreateController } from "./dispatch.js";
import { wrapEvent } from "./event-wrapper.js";
import type { UserEventState } from "./state.js";

/** Options for {@link tab}: when `shift` is set, move focus backward instead of forward. */
export type TabOptions = {
    shift?: boolean;
};

/**
 * Moves keyboard focus to the next focusable widget in the window, or the previous one when `options.shift` is set.
 * @param widget Widget whose window focus is moved.
 * @param options Direction options for the focus move.
 */
export const tab = (widget: Gtk.Widget, options?: TabOptions): Promise<void> =>
    wrapEvent(widget, () => {
        const direction = options?.shift ? Gtk.DirectionType.TAB_BACKWARD : Gtk.DirectionType.TAB_FORWARD;
        const root = widget.getRoot();

        if (root) {
            root.childFocus(direction);
        }
    });

const KEY_MAP: Record<string, number> = {
    Enter: Gdk.KEY_Return,
    Tab: Gdk.KEY_Tab,
    Escape: Gdk.KEY_Escape,
    Backspace: Gdk.KEY_BackSpace,
    Delete: Gdk.KEY_Delete,
    ArrowUp: Gdk.KEY_Up,
    ArrowDown: Gdk.KEY_Down,
    ArrowLeft: Gdk.KEY_Left,
    ArrowRight: Gdk.KEY_Right,
    Home: Gdk.KEY_Home,
    End: Gdk.KEY_End,
    PageUp: Gdk.KEY_Page_Up,
    PageDown: Gdk.KEY_Page_Down,
    Space: Gdk.KEY_space,
    Shift: Gdk.KEY_Shift_L,
    Control: Gdk.KEY_Control_L,
    Alt: Gdk.KEY_Alt_L,
    Meta: Gdk.KEY_Meta_L,
    F1: Gdk.KEY_F1,
    F2: Gdk.KEY_F2,
    F3: Gdk.KEY_F3,
    F4: Gdk.KEY_F4,
    F5: Gdk.KEY_F5,
    F6: Gdk.KEY_F6,
    F7: Gdk.KEY_F7,
    F8: Gdk.KEY_F8,
    F9: Gdk.KEY_F9,
    F10: Gdk.KEY_F10,
    F11: Gdk.KEY_F11,
    F12: Gdk.KEY_F12,
};

type KeyAction = { keyval: number; press: boolean };

const parseKeyToken = (token: string): { keyval: number; press: boolean; release: boolean } => {
    let keyName = token;
    let press = true;
    let release = true;

    if (keyName.startsWith("/")) {
        keyName = keyName.slice(1);
        press = false;
    } else if (keyName.endsWith(">")) {
        keyName = keyName.slice(0, -1);
        release = false;
    }

    const keyval = KEY_MAP[keyName];
    if (keyval === undefined) {
        throw new Error(`Unknown key: {${keyName}}`);
    }
    return { keyval, press, release };
};

const parseKeyboardInput = (input: string): KeyAction[] => {
    const actions: KeyAction[] = [];
    let i = 0;

    while (i < input.length) {
        if (input[i] !== "{") {
            const keyval = input.codePointAt(i) ?? 0;
            actions.push({ keyval, press: true }, { keyval, press: false });
            i++;
            continue;
        }

        const endBrace = input.indexOf("}", i);
        if (endBrace === -1) break;

        const { keyval, press, release } = parseKeyToken(input.slice(i + 1, endBrace));
        if (press) actions.push({ keyval, press: true });
        if (release) actions.push({ keyval, press: false });

        i = endBrace + 1;
    }

    return actions;
};

const MODIFIER_KEYVAL_TO_MASK: Record<number, number> = {
    [Gdk.KEY_Shift_L]: Gdk.ModifierType.SHIFT_MASK,
    [Gdk.KEY_Shift_R]: Gdk.ModifierType.SHIFT_MASK,
    [Gdk.KEY_Control_L]: Gdk.ModifierType.CONTROL_MASK,
    [Gdk.KEY_Control_R]: Gdk.ModifierType.CONTROL_MASK,
    [Gdk.KEY_Alt_L]: Gdk.ModifierType.ALT_MASK,
    [Gdk.KEY_Alt_R]: Gdk.ModifierType.ALT_MASK,
    [Gdk.KEY_Meta_L]: Gdk.ModifierType.META_MASK,
    [Gdk.KEY_Meta_R]: Gdk.ModifierType.META_MASK,
};

const updateModifierState = (state: UserEventState, action: KeyAction): void => {
    const mask = MODIFIER_KEYVAL_TO_MASK[action.keyval];
    if (!mask) return;
    if (action.press) {
        state.modifierState |= mask;
    } else {
        state.modifierState &= ~mask;
    }
};

const matchesTrigger = (trigger: Gtk.ShortcutTrigger | null, keyval: number, modifiers: number): boolean => {
    if (trigger instanceof Gtk.KeyvalTrigger) {
        return trigger.getKeyval() === keyval && trigger.getModifiers() === modifiers;
    }
    if (trigger instanceof Gtk.AlternativeTrigger) {
        return (
            matchesTrigger(trigger.getFirst(), keyval, modifiers) ||
            matchesTrigger(trigger.getSecond(), keyval, modifiers)
        );
    }
    return false;
};

const activateMatchingShortcut = (
    controller: Gtk.ShortcutController,
    widget: Gtk.Widget,
    keyval: number,
    modifiers: number,
): boolean => {
    const count = controller.getNItems();
    for (let j = 0; j < count; j++) {
        const shortcut = controller.getItem(j);
        if (!(shortcut instanceof Gtk.Shortcut)) continue;
        if (!matchesTrigger(shortcut.getTrigger(), keyval, modifiers)) continue;
        const action = shortcut.getAction();
        if (action instanceof Gtk.SignalAction && action.getSignalName() === "move-focus") continue;
        if (action?.activate(0 as Gtk.ShortcutActionFlags, widget, shortcut.getArguments())) return true;
    }
    return false;
};

const dispatchShortcutsOnWidget = (widget: Gtk.Widget, keyval: number, modifiers: number): boolean => {
    const controllers = widget.observeControllers();
    for (let i = 0; i < controllers.getNItems(); i++) {
        const controller = controllers.getItem(i);
        if (
            controller instanceof Gtk.ShortcutController &&
            activateMatchingShortcut(controller, widget, keyval, modifiers)
        ) {
            return true;
        }
    }
    return false;
};

const dispatchShortcuts = (widget: Gtk.Widget, keyval: number, modifiers: number): boolean => {
    const delegate = getEditableDelegate(widget);
    if (delegate && dispatchShortcutsOnWidget(delegate, keyval, modifiers)) return true;
    for (let current: Gtk.Widget | null = widget; current; current = current.getParent()) {
        if (dispatchShortcutsOnWidget(current, keyval, modifiers)) return true;
    }
    return false;
};

const applyKeyAction = async (
    widget: Gtk.Widget,
    controller: Gtk.EventControllerKey,
    state: UserEventState,
    action: KeyAction,
): Promise<void> => {
    updateModifierState(state, action);
    const signalName = action.press ? "key-pressed" : "key-released";
    controller.emit(signalName, action.keyval, 0, state.modifierState);
    if (action.press) {
        const handled = dispatchShortcuts(widget, action.keyval, state.modifierState);
        if (!handled && action.keyval === Gdk.KEY_Return && widget instanceof Gtk.Editable) {
            await fireEvent(widget, "activate");
        }
    }
};

/**
 * Simulates keyboard input on the widget: bare characters are typed and `{...}` tokens press named keys (such as `{Enter}` or `{Control}`), activating any matching shortcuts and tracking modifier state.
 * @param state Accumulated modifier-key state shared across calls.
 * @param widget Widget receiving the key events.
 * @param input Keyboard input string to replay.
 */
export const keyboard = (state: UserEventState, widget: Gtk.Widget, input: string): Promise<void> =>
    dispatchOnOrCreateController(widget, Gtk.EventControllerKey, async (controller) => {
        for (const action of parseKeyboardInput(input)) {
            await applyKeyAction(widget, controller, state, action);
        }
    });
