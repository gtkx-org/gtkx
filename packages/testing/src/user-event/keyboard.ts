import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import type { UserEventState } from "./state.js";
import { getEditableDelegate } from "../editable.js";
import { fireEvent } from "../fire-event.js";
import { getOrCreateControllers } from "./controller.js";
import { wrapEvent } from "./event-wrapper.js";

/** Options for {@link tab}: when `shift` is set, move focus backward instead of forward. */
type TabOptions = {
    shift?: boolean;
};

type KeyAction = { keyval: number; press: boolean };
type ParseStep = { actions: KeyAction[]; next: number };

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

const tab = (widget: Gtk.Widget, options?: TabOptions): Promise<void> =>
    wrapEvent(widget, () => {
        const direction = options?.shift ? Gtk.DirectionType.TAB_BACKWARD : Gtk.DirectionType.TAB_FORWARD;
        const root = widget.getRoot();

        if (root) {
            root.childFocus(direction);
        }
    });

const parseKeyToken = (token: string): { keyval: number; press: boolean; release: boolean } => {
    let keyName = token;
    let isPress = true;
    let isRelease = true;

    if (keyName.startsWith("/")) {
        keyName = keyName.slice(1);
        isPress = false;
    } else if (keyName.endsWith(">")) {
        keyName = keyName.slice(0, -1);
        isRelease = false;
    }

    const keyval = KEY_MAP[keyName];

    if (keyval === undefined) {
        throw new Error(`Unknown key: {${keyName}}`);
    }

    return { keyval, press: isPress, release: isRelease };
};

const parseCharAt = (input: string, i: number): ParseStep => {
    const keyval = input.codePointAt(i) ?? 0;

    return {
        actions: [
            { keyval, press: true },
            { keyval, press: false },
        ],
        next: i + 1,
    };
};

const parseBraceAt = (input: string, i: number): ParseStep | null => {
    const endBrace = input.indexOf("}", i);

    if (endBrace === -1) {
        return null;
    }

    const { keyval, press, release } = parseKeyToken(input.slice(i + 1, endBrace));
    const actions: KeyAction[] = [];

    if (press) {
        actions.push({ keyval, press: true });
    }

    if (release) {
        actions.push({ keyval, press: false });
    }

    return { actions, next: endBrace + 1 };
};

const parseStepAt = (input: string, i: number): ParseStep | null =>
    input[i] === "{" ? parseBraceAt(input, i) : parseCharAt(input, i);

const parseKeyboardInput = (input: string): KeyAction[] => {
    const actions: KeyAction[] = [];
    let i = 0;

    while (i < input.length) {
        const step = parseStepAt(input, i);

        if (step === null) {
            break;
        }

        actions.push(...step.actions);
        i = step.next;
    }

    return actions;
};

const updateModifierState = (state: UserEventState, action: KeyAction): void => {
    const mask = MODIFIER_KEYVAL_TO_MASK[action.keyval];

    if (!mask) {
        return;
    }

    if (action.press) {
        state.modifierState |= mask;
    } else {
        state.modifierState &= ~mask;
    }
};

const isTriggerMatch = (
    trigger: Gtk.ShortcutTrigger | null,
    keyval: number,
    modifiers: Gdk.ModifierType,
): boolean => {
    if (trigger instanceof Gtk.KeyvalTrigger) {
        return trigger.getKeyval() === keyval && trigger.getModifiers() === modifiers;
    }

    if (trigger instanceof Gtk.AlternativeTrigger) {
        return (
            isTriggerMatch(trigger.getFirst(), keyval, modifiers) ||
            isTriggerMatch(trigger.getSecond(), keyval, modifiers)
        );
    }

    return false;
};

const didActivateShortcut = (
    shortcut: Gtk.Shortcut,
    widget: Gtk.Widget,
    keyval: number,
    modifiers: Gdk.ModifierType,
): boolean => {
    if (!isTriggerMatch(shortcut.getTrigger(), keyval, modifiers)) {
        return false;
    }

    const action = shortcut.getAction();

    if (action instanceof Gtk.SignalAction && action.getSignalName() === "move-focus") {
        return false;
    }

    return action?.activate(0 as Gtk.ShortcutActionFlags, widget, shortcut.getArguments()) ?? false;
};

const didActivateMatchingShortcut = (
    controller: Gtk.ShortcutController,
    widget: Gtk.Widget,
    keyval: number,
    modifiers: number,
): boolean => {
    const count = controller.getNItems();

    for (let j = 0; j < count; j++) {
        const shortcut = controller.getItem(j);

        if (!(shortcut instanceof Gtk.Shortcut)) {
            continue;
        }

        if (didActivateShortcut(shortcut, widget, keyval, modifiers)) {
            return true;
        }
    }

    return false;
};

const didDispatchShortcutsOnWidget = (widget: Gtk.Widget, keyval: number, modifiers: number): boolean => {
    const controllers = widget.observeControllers();

    for (let i = 0; i < controllers.getNItems(); i++) {
        const controller = controllers.getItem(i);

        if (
            controller instanceof Gtk.ShortcutController &&
            didActivateMatchingShortcut(controller, widget, keyval, modifiers)
        ) {
            return true;
        }
    }

    return false;
};

const didDispatchShortcuts = (widget: Gtk.Widget, keyval: number, modifiers: number): boolean => {
    const delegate = getEditableDelegate(widget);

    if (delegate && didDispatchShortcutsOnWidget(delegate, keyval, modifiers)) {
        return true;
    }

    for (let current: Gtk.Widget | null = widget; current; current = current.getParent()) {
        if (didDispatchShortcutsOnWidget(current, keyval, modifiers)) {
            return true;
        }
    }

    return false;
};

const handleKeyPress = async (widget: Gtk.Widget, keyval: number, modifiers: number): Promise<void> => {
    const isHandled = didDispatchShortcuts(widget, keyval, modifiers);

    if (!isHandled && keyval === Gdk.KEY_Return && widget instanceof Gtk.Editable) {
        await fireEvent(widget, "activate");
    }
};

const applyKeyAction = async (
    widget: Gtk.Widget,
    controllers: Gtk.EventControllerKey[],
    state: UserEventState,
    action: KeyAction,
): Promise<void> => {
    updateModifierState(state, action);
    const signalName = action.press ? "key-pressed" : "key-released";

    for (const controller of controllers) {
        controller.emit(signalName, action.keyval, 0, state.modifierState);
    }

    if (action.press) {
        await handleKeyPress(widget, action.keyval, state.modifierState);
    }
};

const keyboard = (state: UserEventState, widget: Gtk.Widget, input: string): Promise<void> =>
    wrapEvent(widget, async () => {
        const controllers = getOrCreateControllers(widget, Gtk.EventControllerKey);

        for (const action of parseKeyboardInput(input)) {
            await applyKeyAction(widget, controllers, state, action);
        }
    });

export { tab, keyboard, type TabOptions };
