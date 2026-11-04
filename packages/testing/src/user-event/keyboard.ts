import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { getInstanceType, TYPE_INVALID, typeFromName, typeIsA } from "@gtkx/runtime";
import { hasSignalListener } from "@gtkx/runtime/internal";
import type { UserEventState } from "./state.js";
import { getEditableDelegate } from "../editable.js";
import { fireEvent } from "../fire-event.js";
import { ancestors, descendants } from "../traversal.js";
import { wrapEvent } from "./event-wrapper.js";
import { usageError } from "../usage-error.js";
import { getWidgetTypeName } from "../widget-getters.js";
import { activeToplevel, mappedToplevels } from "../window-state.js";

/** Options for `userEvent.tab`. */
type TabOptions = {
    /** Move focus backward instead of forward. */
    isShiftHeld?: boolean;
};

type KeyAction = { keyval: number; isPress: boolean };
type ParseStep = { actions: KeyAction[]; next: number };
type TypedStep = { text: string } | { actions: KeyAction[] };
type TypedParseStep = { step: TypedStep; next: number };
type KeyStopController = Gtk.EventControllerKey | Gtk.ShortcutController;
type KeyStop = { widget: Gtk.Widget; controller: KeyStopController };
type KeyTarget = { root: Gtk.Root | null; focus: Gtk.Widget | null };
type MatchingShortcut = { shortcut: Gtk.Shortcut; host: Gtk.Widget; index: number };

const lastActivatedShortcuts: WeakMap<Gtk.ShortcutController, number> = new WeakMap();

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

const KEY_CONTROLLER_SIGNALS = ["key-pressed", "key-released"];
const LITERAL_BRACE = "{{";

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

/** Moves focus within the widget's root. */
const tab = (widget: Gtk.Widget, options?: TabOptions): Promise<void> =>
    wrapEvent(widget, () => {
        const direction = options?.isShiftHeld ? Gtk.DirectionType.TAB_BACKWARD : Gtk.DirectionType.TAB_FORWARD;
        const root = widget.getRoot();

        if (root) {
            root.childFocus(direction);
        }
    });

const characterKeyval = (keyName: string): number | undefined => {
    const [character, ...rest] = Array.from(keyName);

    return character === undefined || rest.length > 0 ? undefined : Gdk.unicodeToKeyval(character.codePointAt(0) ?? 0);
};

const parseKeyToken = (token: string): { keyval: number; isPress: boolean; isRelease: boolean } => {
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

    const keyval = KEY_MAP[keyName] ?? characterKeyval(keyName);

    if (keyval === undefined) {
        throw usageError(new Error(`Unknown key: {${keyName}}`));
    }

    return { keyval, isPress, isRelease };
};

const parseCharAt = (input: string, i: number): ParseStep => {
    const character = input.codePointAt(i) ?? 0;
    const keyval = Gdk.unicodeToKeyval(character);

    return {
        actions: [
            { keyval, isPress: true },
            { keyval, isPress: false },
        ],
        next: i + String.fromCodePoint(character).length,
    };
};

const parseBraceAt = (input: string, i: number): ParseStep | null => {
    const endBrace = input.indexOf("}", i);

    if (endBrace === -1) {
        return null;
    }

    const { keyval, isPress, isRelease } = parseKeyToken(input.slice(i + 1, endBrace));
    const actions: KeyAction[] = [];

    if (isPress) {
        actions.push({ keyval, isPress: true });
    }

    if (isRelease) {
        actions.push({ keyval, isPress: false });
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

const characterActions = (text: string): KeyAction[] =>
    Array.from(text, (character) => parseCharAt(character, 0).actions).flat();

const parseTypedTextAt = (input: string, i: number): TypedParseStep => {
    const brace = input.indexOf("{", i);
    const next = brace === -1 ? input.length : brace;

    return { step: { text: input.slice(i, next) }, next };
};

const parseTypedStepAt = (input: string, i: number): TypedParseStep => {
    if (input.startsWith(LITERAL_BRACE, i)) {
        return { step: { text: "{" }, next: i + LITERAL_BRACE.length };
    }

    if (input[i] !== "{") {
        return parseTypedTextAt(input, i);
    }

    const brace = parseBraceAt(input, i);

    if (brace === null) {
        throw usageError(new Error(`Unclosed key descriptor at ${String(i)} in "${input}"; type a literal { as {{`));
    }

    return { step: { actions: brace.actions }, next: brace.next };
};

const appendTypedStep = (steps: TypedStep[], step: TypedStep): void => {
    const last = steps.at(-1);

    if (last !== undefined && "text" in last && "text" in step) {
        steps[steps.length - 1] = { text: last.text + step.text };

        return;
    }

    steps.push(step);
};

const parseTypedInput = (input: string): TypedStep[] => {
    const steps: TypedStep[] = [];
    let i = 0;

    while (i < input.length) {
        const { step, next } = parseTypedStepAt(input, i);
        appendTypedStep(steps, step);
        i = next;
    }

    return steps;
};

const updateModifierState = (state: UserEventState, action: KeyAction): void => {
    const mask = MODIFIER_KEYVAL_TO_MASK[action.keyval];

    if (!mask) {
        return;
    }

    if (action.isPress) {
        state.modifierState |= mask;
    } else {
        state.modifierState &= ~mask;
    }
};

const isTriggerMatch = (
    trigger: Gtk.ShortcutTrigger | null,
    keyval: number,
    modifiers: Gdk.ModifierType,
    areMnemonicsEnabled: boolean,
): boolean => {
    if (trigger instanceof Gtk.KeyvalTrigger) {
        return trigger.getKeyval() === keyval && trigger.getModifiers() === modifiers;
    }

    if (trigger instanceof Gtk.MnemonicTrigger) {
        const mnemonicKeyval = keyval === Gdk.KEY_ISO_Left_Tab ? Gdk.KEY_Tab : Gdk.keyvalToLower(keyval);

        return areMnemonicsEnabled && trigger.getKeyval() === mnemonicKeyval;
    }

    if (trigger instanceof Gtk.AlternativeTrigger) {
        return (
            isTriggerMatch(trigger.getFirst(), keyval, modifiers, areMnemonicsEnabled) ||
            isTriggerMatch(trigger.getSecond(), keyval, modifiers, areMnemonicsEnabled)
        );
    }

    return false;
};

const controllersOn = function* (widget: Gtk.Widget): Generator<Gtk.EventController> {
    const controllers = widget.observeControllers();
    const count = controllers.getNItems();

    for (let i = 0; i < count; i++) {
        const controller = controllers.getItem(i);

        if (controller instanceof Gtk.EventController) {
            yield controller;
        }
    }
};

const hasShortcut = (controller: Gtk.ShortcutController, shortcut: Gtk.Shortcut): boolean => {
    const count = controller.getNItems();

    for (let i = 0; i < count; i++) {
        if (controller.getItem(i) === shortcut) {
            return true;
        }
    }

    return false;
};

const isManagingShortcut = (controller: Gtk.EventController, shortcut: Gtk.Shortcut): boolean =>
    controller instanceof Gtk.ShortcutController &&
    controller.getScope() !== Gtk.ShortcutScope.LOCAL &&
    hasShortcut(controller, shortcut);

const managedShortcutHost = (manager: Gtk.Widget, shortcut: Gtk.Shortcut): Gtk.Widget | null => {
    for (const current of [manager, ...descendants(manager)]) {
        if (controllersOn(current).some((controller) => isManagingShortcut(controller, shortcut))) {
            return current;
        }
    }

    return null;
};

const isShortcutLive = (host: Gtk.Widget): boolean => host.isSensitive() && host.getMapped();

const didRunShortcutAction = (shortcut: Gtk.Shortcut, host: Gtk.Widget, flags: Gtk.ShortcutActionFlags): boolean => {
    const action = shortcut.getAction();

    if (action === null || !isShortcutLive(host)) {
        return false;
    }

    return action.activate(flags, host, shortcut.getArguments());
};

const mnemonicModifiersFor = (widget: Gtk.Widget, keyval: number, modifiers: Gdk.ModifierType): Gdk.ModifierType => {
    const display = widget.getDisplay();
    const [, keys] = display.mapKeyval(keyval);
    const key = keys[0];
    const consumed = key === undefined ? 0 : display.translateKey(key.keycode, modifiers, key.group)[4];

    return modifiers & ~consumed & Gtk.acceleratorGetDefaultModMask();
};

const matchingShortcuts = (
    controller: Gtk.ShortcutController,
    widget: Gtk.Widget,
    keyval: number,
    modifiers: Gdk.ModifierType,
): MatchingShortcut[] => {
    const count = controller.getNItems();

    if (count === 0) {
        return [];
    }

    const areMnemonicsEnabled = mnemonicModifiersFor(widget, keyval, modifiers) === controller.getMnemonicsModifiers();
    const offset = areMnemonicsEnabled ? (lastActivatedShortcuts.get(controller) ?? 0) + 1 : 0;
    const matches: MatchingShortcut[] = [];

    for (let j = 0; j < count; j++) {
        const index = (offset + j) % count;
        const shortcut = controller.getItem(index);

        if (
            !(shortcut instanceof Gtk.Shortcut) ||
            !isTriggerMatch(shortcut.getTrigger(), keyval, modifiers, areMnemonicsEnabled)
        ) {
            continue;
        }

        const host = managedShortcutHost(widget, shortcut) ?? widget;

        if (isShortcutLive(host)) {
            matches.push({ shortcut, host, index });
        }
    }

    return matches;
};

const didActivateMatchingShortcut = (
    controller: Gtk.ShortcutController,
    widget: Gtk.Widget,
    keyval: number,
    modifiers: number,
): boolean => {
    const matches = matchingShortcuts(controller, widget, keyval, modifiers);

    for (const [index, match] of matches.entries()) {
        const flags = (index === matches.length - 1 ? Gtk.ShortcutActionFlags.EXCLUSIVE : 0) as Gtk.ShortcutActionFlags;

        if (didRunShortcutAction(match.shortcut, match.host, flags)) {
            lastActivatedShortcuts.set(controller, match.index);

            return true;
        }
    }

    return false;
};

const isAccelMatch = (accel: string, keyval: number, modifiers: Gdk.ModifierType): boolean => {
    const [isParsed, accelKeyval, accelModifiers] = Gtk.acceleratorParse(accel);

    return isParsed && accelKeyval === keyval && accelModifiers === modifiers;
};

const hasMatchingAccel = (
    application: Gtk.Application,
    detailedActionName: string,
    keyval: number,
    modifiers: number,
): boolean =>
    application.getAccelsForAction(detailedActionName).some((accel) => isAccelMatch(accel, keyval, modifiers));

const didActivateDetailedAction = (window: Gtk.Window, detailedActionName: string): boolean => {
    const [isParsed, actionName, target] = Gio.Action.parseDetailedName(detailedActionName);

    return isParsed && window.activateAction(actionName, target);
};

const didDispatchAccelsOnWindow = (window: Gtk.Window, keyval: number, modifiers: number): boolean => {
    const application = window.getApplication();

    if (!application) {
        return false;
    }

    for (const detailedActionName of application.listActionDescriptions()) {
        if (hasMatchingAccel(application, detailedActionName, keyval, modifiers)) {
            return didActivateDetailedAction(window, detailedActionName);
        }
    }

    return false;
};

const isEventLimit = (widget: Gtk.Widget): boolean => widget instanceof Gtk.Native || widget.getLimitEvents();

const eventLimitOf = (widget: Gtk.Widget): Gtk.Widget | undefined => [widget, ...ancestors(widget)].find(isEventLimit);

const receivesEventsFor = (owner: Gtk.Widget, limit: Gtk.PropagationLimit, target: Gtk.Widget): boolean =>
    limit === Gtk.PropagationLimit.NONE || eventLimitOf(owner) === eventLimitOf(target);

const didDispatchApplicationAccels = (target: Gtk.Widget, keyval: number, modifiers: number): boolean => {
    const root = target.getRoot();

    return (
        root instanceof Gtk.Window &&
        receivesEventsFor(root, Gtk.PropagationLimit.SAME_NATIVE, target) &&
        didDispatchAccelsOnWindow(root, keyval, modifiers)
    );
};

const SEARCH_BAR_CAPTURE_NAME = "gtk-search-bar-capture";
const ENTRY_COMPLETION_CLASS = "entry-completion";
const FILE_CHOOSER_ENTRY_TYPE_NAME = "GtkFileChooserEntry";
const CELL_EDITABLE_TYPE_NAME = "GtkCellEditableWidget";

/**
 * GTK has no public getter for a text view's own key controller (`gtk_text_view_get_key_controller` is private) and
 * lists controllers newest first, so the last key controller is the one the text view added when it was created.
 * Controllers that subclasses such as GtkSourceView add read the current event, which emulated keys lack.
 */
const isTextViewKeyController = (controller: Gtk.EventController, widget: Gtk.Widget): boolean =>
    controllersOn(widget)
        .filter((current) => current instanceof Gtk.EventControllerKey)
        .toArray()
        .at(-1) === controller;

const isTextViewLibraryController = (controller: Gtk.EventController, widget: Gtk.Widget): boolean =>
    widget instanceof Gtk.TextView && !isTextViewKeyController(controller, widget);

const capturesKeysOf = (candidate: Gtk.Widget, widget: Gtk.Widget): boolean =>
    (candidate instanceof Gtk.SearchEntry || candidate instanceof Gtk.SearchBar) &&
    candidate.getKeyCaptureWidget() === widget;

/**
 * A search entry or search bar with a key capture widget adds a key controller to that widget, which forwards the
 * current event to the entry. The search bar names its controller; the search entry leaves its own unnamed.
 */
const isSearchKeyCapture = (controller: Gtk.EventController, widget: Gtk.Widget): boolean => {
    const name = controller.getName();

    return (
        name === SEARCH_BAR_CAPTURE_NAME ||
        (name === null &&
            (capturesKeysOf(widget, widget) ||
                descendants(widget).some((candidate) => capturesKeysOf(candidate, widget))))
    );
};

const isFileChooserForwarder = (_controller: Gtk.EventController, widget: Gtk.Widget): boolean =>
    widget instanceof Gtk.FileChooserWidget || getWidgetTypeName(widget) === FILE_CHOOSER_ENTRY_TYPE_NAME;

/**
 * Widget types from other libraries whose key controllers read the current event: WebKit filters it through its input
 * method and passes it to the web process.
 */
const EVENT_READING_LIBRARY_TYPE_NAMES = ["WebKitWebViewBase"];

const isLibraryEventReader = (_controller: Gtk.EventController, widget: Gtk.Widget): boolean =>
    EVENT_READING_LIBRARY_TYPE_NAMES.some((name) => {
        const type = typeFromName(name);

        return type !== TYPE_INVALID && typeIsA(getInstanceType(widget), type);
    });

const isDeprecatedPopup = (widget: Gtk.Widget): boolean =>
    widget instanceof Gtk.Popover &&
    (widget.getParent() instanceof Gtk.ComboBox || widget.hasCssClass(ENTRY_COMPLETION_CLASS));

const isDeprecatedWidgetForwarder = (_controller: Gtk.EventController, widget: Gtk.Widget): boolean =>
    widget instanceof Gtk.TreeView ||
    getWidgetTypeName(widget) === CELL_EDITABLE_TYPE_NAME ||
    isDeprecatedPopup(widget);

/**
 * Key controllers GTK and its libraries add without a JavaScript listener whose handlers need the real key event,
 * which emulated keys lack: they filter it through an input method, forward it with
 * `gtk_event_controller_key_forward()` or read it directly, and log a critical without one. Emulated keys skip them;
 * every other key controller receives the keys.
 */
const REAL_EVENT_KEY_HANDLERS: ((controller: Gtk.EventController, widget: Gtk.Widget) => boolean)[] = [
    isTextViewLibraryController,
    isSearchKeyCapture,
    isFileChooserForwarder,
    isDeprecatedWidgetForwarder,
    isLibraryEventReader,
];

const needsRealKeyEvent = (controller: Gtk.EventController, widget: Gtk.Widget): boolean =>
    REAL_EVENT_KEY_HANDLERS.some((needsEvent) => needsEvent(controller, widget));

const isKeyStopController = (controller: Gtk.EventController, widget: Gtk.Widget): controller is KeyStopController => {
    if (controller instanceof Gtk.ShortcutController) {
        return controller.getScope() === Gtk.ShortcutScope.LOCAL;
    }

    return (
        controller instanceof Gtk.EventControllerKey &&
        (hasSignalListener(controller, KEY_CONTROLLER_SIGNALS) || !needsRealKeyEvent(controller, widget))
    );
};

const keyStopsInPhase = (widget: Gtk.Widget, phase: Gtk.PropagationPhase, target: Gtk.Widget): KeyStop[] => {
    const stops: KeyStop[] = [];

    for (const controller of controllersOn(widget)) {
        if (
            controller.getPropagationPhase() === phase &&
            receivesEventsFor(widget, controller.getPropagationLimit(), target) &&
            isKeyStopController(controller, widget)
        ) {
            stops.push({ widget, controller });
        }
    }

    return stops;
};

const focusWithin = (widget: Gtk.Widget): Gtk.Widget | null => {
    const root = widget.getRoot();
    const focus = root instanceof Gtk.Window ? root.getFocus() : null;

    return focus !== null && focus.isAncestor(widget) ? focus : null;
};

const propagationChain = (widget: Gtk.Widget): Gtk.Widget[] => {
    const focus = focusWithin(widget);

    if (focus !== null) {
        return [focus, ...ancestors(focus)];
    }

    const delegate = getEditableDelegate(widget);
    const below = delegate === null ? [] : [delegate];

    return [...below, widget, ...ancestors(widget)];
};

const keyPropagationChain = (widget: Gtk.Widget): KeyStop[] => {
    const chain = propagationChain(widget);
    const [eventWidget = widget] = chain;

    return [
        ...chain.toReversed().flatMap((current) => keyStopsInPhase(current, Gtk.PropagationPhase.CAPTURE, eventWidget)),
        ...keyStopsInPhase(eventWidget, Gtk.PropagationPhase.TARGET, eventWidget),
        ...chain.flatMap((current) => keyStopsInPhase(current, Gtk.PropagationPhase.BUBBLE, eventWidget)),
    ];
};

const didStopHandlePress = (stop: KeyStop, keyval: number, modifiers: Gdk.ModifierType): boolean => {
    const { controller, widget } = stop;

    if (controller instanceof Gtk.ShortcutController) {
        return didActivateMatchingShortcut(controller, widget, keyval, modifiers);
    }

    return controller.emit("key-pressed", keyval, 0, modifiers);
};

const keyTargetFor = (widget: Gtk.Widget): KeyTarget => {
    const root = widget.getRoot();

    return { root, focus: root instanceof Gtk.Window ? root.getFocus() : null };
};

const isKeyTargetInvalidated = (widget: Gtk.Widget, target: KeyTarget): boolean => {
    const current = keyTargetFor(widget);

    return current.root !== target.root || current.focus !== target.focus || !widget.getMapped();
};

const didHandlePress = (widget: Gtk.Widget, keyval: number, modifiers: Gdk.ModifierType): boolean => {
    const target = keyTargetFor(widget);
    const [eventWidget = widget] = propagationChain(widget);

    if (didDispatchApplicationAccels(eventWidget, keyval, modifiers)) {
        return true;
    }

    if (isKeyTargetInvalidated(widget, target)) {
        return true;
    }

    for (const stop of keyPropagationChain(widget)) {
        if (didStopHandlePress(stop, keyval, modifiers) || isKeyTargetInvalidated(widget, target)) {
            return true;
        }
    }

    return false;
};

const emitKeyReleased = (widget: Gtk.Widget, keyval: number, modifiers: Gdk.ModifierType): void => {
    for (const stop of keyPropagationChain(widget)) {
        if (stop.controller instanceof Gtk.EventControllerKey) {
            stop.controller.emit("key-released", keyval, 0, modifiers);
        }
    }
};

const applyKeyPress = async (widget: Gtk.Widget, keyval: number, modifiers: Gdk.ModifierType): Promise<boolean> => {
    if (didHandlePress(widget, keyval, modifiers)) {
        return true;
    }

    if (keyval === Gdk.KEY_Return && widget instanceof Gtk.Editable) {
        await fireEvent(widget, "activate");

        return true;
    }

    return false;
};

const isUnhandledPress = async (widget: Gtk.Widget, state: UserEventState, action: KeyAction): Promise<boolean> => {
    updateModifierState(state, action);

    if (!action.isPress) {
        emitKeyReleased(widget, action.keyval, state.modifierState);

        return false;
    }

    const isHandled = await applyKeyPress(widget, action.keyval, state.modifierState);

    return !isHandled && MODIFIER_KEYVAL_TO_MASK[action.keyval] === undefined;
};

const currentKeyWidget = (widget: Gtk.Widget, start: KeyTarget): Gtk.Widget => {
    const { root, focus } = keyTargetFor(widget);

    return root === start.root && focus !== null && focus !== start.focus && !focus.isAncestor(widget) ? focus : widget;
};

/** Applies the key actions and returns the keyvals of the presses, other than modifiers, that nothing handled. */
const applyKeyActions = async (widget: Gtk.Widget, state: UserEventState, actions: KeyAction[]): Promise<number[]> => {
    const start = keyTargetFor(widget);
    const unhandled: number[] = [];

    for (const action of actions) {
        if (await isUnhandledPress(currentKeyWidget(widget, start), state, action)) {
            unhandled.push(action.keyval);
        }
    }

    return unhandled;
};

const keyLabel = (keyval: number): string => {
    const name = Object.keys(KEY_MAP).find((key) => KEY_MAP[key] === keyval);
    const character = Gdk.keyvalToUnicode(keyval);

    if (name !== undefined) {
        return `{${name}}`;
    }

    return character === 0 ? `{${Gdk.keyvalName(keyval) ?? String(keyval)}}` : String.fromCodePoint(character);
};

/**
 * Focuses a focusable target whose window has its focus elsewhere, as a user does before typing, so the window's
 * own bindings such as {Space} and {Enter} activating the focus widget act on the target.
 */
const focusKeyTarget = (widget: Gtk.Widget): void => {
    if (focusWithin(widget) === null && widget.getFocusable() && widget.getCanFocus()) {
        widget.grabFocus();
    }
};

/**
 * Sends the key sequence and returns the keys, as `keyboard` input would name them, whose presses nothing on the
 * widget, its focused descendant or their ancestors handled.
 */
const keyboard = async (state: UserEventState, widget: Gtk.Widget, input: string): Promise<string[]> => {
    let unhandled: number[] = [];

    await wrapEvent(widget, async () => {
        focusKeyTarget(widget);
        unhandled = await applyKeyActions(widget, state, parseKeyboardInput(input));
    });

    return [...new Set(unhandled.map((keyval) => keyLabel(keyval)))];
};

const focusedKeyWidget = (): Gtk.Widget => {
    const window = activeToplevel() ?? mappedToplevels()[0];

    if (window === undefined) {
        throw usageError(new Error("No window is open to receive the keys"));
    }

    const focus = window.getFocus();

    return focus?.getMapped() ? focus : window;
};

export {
    applyKeyActions,
    characterActions,
    focusedKeyWidget,
    keyboard,
    parseTypedInput,
    tab,
    type TabOptions,
    type TypedStep,
};
