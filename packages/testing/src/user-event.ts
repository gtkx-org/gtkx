import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "./fire-event.js";
import { act } from "./timing.js";
import { isEditable } from "./widget.js";

/**
 * Content payload accepted by {@link userEvent.drop} and
 * {@link userEvent.dragAndDrop}.
 *
 * Primitives are auto-marshalled to a `GObject.Value` of the matching `GType`.
 * Pre-constructed `GObject.Value` instances are forwarded unchanged so callers
 * can supply boxed / object types that the auto-marshaller does not cover.
 */
export type DropContent = string | number | boolean | GObject.Value;

/**
 * Optional drop coordinates relative to the target widget.
 */
export type DropOptions = {
    /** X coordinate of the drop, in widget-local pixels (default: 0). */
    x?: number;
    /** Y coordinate of the drop, in widget-local pixels (default: 0). */
    y?: number;
};

const wrapValue = (content: DropContent): GObject.Value => {
    if (content instanceof GObject.Value) return content;
    const value = new GObject.Value();
    if (typeof content === "string") {
        value.init(GObject.Type.STRING);
        value.setString(content);
        return value;
    }
    if (typeof content === "boolean") {
        value.init(GObject.Type.BOOLEAN);
        value.setBoolean(content);
        return value;
    }
    value.init(GObject.Type.DOUBLE);
    value.setDouble(content);
    return value;
};

const findController = <T extends Gtk.EventController>(
    element: Gtk.Widget,
    controllerType: new (...args: never[]) => T,
): T => {
    const controllers = element.observeControllers();
    const nItems = controllers.getNItems();
    for (let i = 0; i < nItems; i++) {
        const controller = controllers.getItem(i);
        if (controller instanceof controllerType) return controller;
    }
    throw new Error(`No ${controllerType.name} controller is attached to the widget`);
};

/**
 * Options for tab navigation.
 */
export type TabOptions = {
    /** Navigate backwards (Shift+Tab) instead of forwards */
    shift?: boolean;
};

const click = async (element: Gtk.Widget): Promise<void> => {
    if (element instanceof Gtk.Button) {
        await emitClickSequence(element, 1);
        return;
    }
    await act(() => {
        element.activate();
    });
};

const emitClickSequence = async (element: Gtk.Widget, nPress: number): Promise<void> => {
    await act(() => {
        const controller = getOrCreateController(element, Gtk.GestureClick);

        for (let i = 1; i <= nPress; i++) {
            controller.emit("pressed", i, 0, 0);
            controller.emit("released", i, 0, 0);
        }
    });
};

const dblClick = (element: Gtk.Widget): Promise<void> => emitClickSequence(element, 2);

const tripleClick = (element: Gtk.Widget): Promise<void> => emitClickSequence(element, 3);

const tab = async (element: Gtk.Widget, options?: TabOptions): Promise<void> => {
    await act(() => {
        const direction = options?.shift ? Gtk.DirectionType.TAB_BACKWARD : Gtk.DirectionType.TAB_FORWARD;
        const root = element.getRoot();

        if (root && root instanceof Gtk.Widget) {
            root.childFocus(direction);
        }
    });
};

const getEditableDelegate = (element: Gtk.Widget): Gtk.Widget | null => {
    if (!isEditable(element)) return null;
    const getDelegate = (element as { getDelegate?: () => Gtk.Editable | null }).getDelegate;
    if (typeof getDelegate !== "function") return null;
    const delegate = getDelegate.call(element);
    return delegate instanceof Gtk.Widget ? delegate : null;
};

const type = async (element: Gtk.Widget, text: string): Promise<void> => {
    await act(() => {
        if (!isEditable(element)) {
            throw new Error(
                "Cannot type into element: expected editable widget (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)",
            );
        }

        const target = getEditableDelegate(element) ?? element;
        if (target instanceof Gtk.Text || target instanceof Gtk.TextView) {
            target.emit("insert-at-cursor", text);
            return;
        }

        const position = element.getPosition();
        const newPosition = element.insertText(text, text.length, position);
        element.setPosition(newPosition);
    });
};

const clear = async (element: Gtk.Widget): Promise<void> => {
    await act(() => {
        if (!isEditable(element)) {
            throw new Error("Cannot clear element: expected editable widget (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)");
        }

        element.setText("");
    });
};

const SELECTABLE_ROLES = new Set<Gtk.AccessibleRole>([Gtk.AccessibleRole.COMBO_BOX, Gtk.AccessibleRole.LIST]);

const isSelectable = (widget: Gtk.Widget): boolean => {
    if (!widget) return false;
    return SELECTABLE_ROLES.has(widget.getAccessibleRole());
};

const selectListViewItems = (selectionModel: Gtk.SelectionModel, positions: number[], exclusive: boolean): void => {
    if (positions.length === 0) {
        selectionModel.unselectRange(0, selectionModel.getNItems());
        return;
    }

    const [first] = positions;
    if (exclusive && positions.length === 1 && first !== undefined) {
        selectionModel.selectItem(first, true);
        return;
    }

    const nItems = selectionModel.getNItems();
    const selected = Gtk.Bitset.newEmpty();
    const mask = Gtk.Bitset.newRange(0, nItems);

    for (const pos of positions) {
        selected.add(pos);
    }

    selectionModel.setSelection(selected, mask);
};

const isListView = (widget: Gtk.Widget): widget is Gtk.ListView | Gtk.GridView | Gtk.ColumnView => {
    return widget instanceof Gtk.ListView || widget instanceof Gtk.GridView || widget instanceof Gtk.ColumnView;
};

const selectComboBoxOption = (element: Gtk.Widget, values: number | number[], valueArray: number[]): void => {
    if (Array.isArray(values) && values.length > 1) {
        throw new Error("Cannot select multiple options: ComboBox only supports single selection");
    }
    const [selection] = valueArray;
    if (selection === undefined) return;
    if (element instanceof Gtk.DropDown) {
        element.setSelected(selection);
    } else if (element instanceof Gtk.ComboBox) {
        element.setActive(selection);
    }
};

const selectListBoxOptions = (element: Gtk.ListBox, valueArray: number[]): void => {
    for (const value of valueArray) {
        const row = element.getRowAtIndex(value);
        if (row) {
            element.selectRow(row);
            row.activate();
        }
    }
};

const selectInListView = (element: Gtk.ListView | Gtk.GridView | Gtk.ColumnView, valueArray: number[]): void => {
    const selectionModel = element.getModel();
    if (selectionModel === null) {
        throw new Error("Cannot select options: list view has no selection model");
    }
    const isMultiSelection = selectionModel instanceof Gtk.MultiSelection;
    selectListViewItems(selectionModel, valueArray, !isMultiSelection);
};

const selectByRole = (element: Gtk.Widget, values: number | number[], valueArray: number[]): void => {
    if (!isSelectable(element)) {
        throw new Error("Cannot select options: expected selectable widget (COMBO_BOX or LIST)");
    }

    const role = element.getAccessibleRole();
    if (role === Gtk.AccessibleRole.COMBO_BOX) {
        selectComboBoxOption(element, values, valueArray);
    } else if (role === Gtk.AccessibleRole.LIST) {
        selectListBoxOptions(element as Gtk.ListBox, valueArray);
    }
};

const selectOptions = async (element: Gtk.Widget, values: number | number[]): Promise<void> => {
    await act(() => {
        const valueArray = Array.isArray(values) ? values : [values];
        if (isListView(element)) {
            selectInListView(element, valueArray);
            return;
        }
        selectByRole(element, values, valueArray);
    });
};

const deselectInListView = (element: Gtk.ListView | Gtk.GridView | Gtk.ColumnView, valueArray: number[]): void => {
    const selectionModel = element.getModel();
    if (selectionModel === null) {
        throw new Error("Cannot deselect options: list view has no selection model");
    }
    for (const pos of valueArray) {
        selectionModel.unselectItem(pos);
    }
};

const deselectInListBox = (listBox: Gtk.ListBox, valueArray: number[]): void => {
    for (const value of valueArray) {
        const row = listBox.getRowAtIndex(value);
        if (row) {
            listBox.unselectRow(row);
        }
    }
};

const deselectOptions = async (element: Gtk.Widget, values: number | number[]): Promise<void> => {
    await act(() => {
        const valueArray = Array.isArray(values) ? values : [values];
        if (isListView(element)) {
            deselectInListView(element, valueArray);
            return;
        }
        if (element.getAccessibleRole() !== Gtk.AccessibleRole.LIST) {
            throw new Error("Cannot deselect options: only ListBox supports deselection");
        }
        deselectInListBox(element as Gtk.ListBox, valueArray);
    });
};

const getOrCreateController = <T extends Gtk.EventController>(element: Gtk.Widget, controllerType: new () => T): T => {
    const controllers = element.observeControllers();
    const nItems = controllers.getNItems();

    for (let i = 0; i < nItems; i++) {
        const controller = controllers.getItem(i);
        if (controller instanceof controllerType) {
            return controller;
        }
    }

    const controller = new controllerType();
    element.addController(controller);
    return controller;
};

const hover = async (element: Gtk.Widget): Promise<void> => {
    await act(() => {
        const controller = getOrCreateController(element, Gtk.EventControllerMotion);
        controller.emit("enter", 0, 0);
    });
};

const unhover = async (element: Gtk.Widget): Promise<void> => {
    await act(() => {
        const controller = getOrCreateController(element, Gtk.EventControllerMotion);
        controller.emit("leave");
    });
};

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

type UserEventState = {
    modifierState: number;
    mouseLeftDown: boolean;
};

const createInitialState = (): UserEventState => ({ modifierState: 0, mouseLeftDown: false });

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
        if (action?.activate(0 as Gtk.ShortcutActionFlags, widget, null)) return true;
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

const dispatchShortcuts = (element: Gtk.Widget, keyval: number, modifiers: number): boolean => {
    const delegate = getEditableDelegate(element);
    if (delegate && dispatchShortcutsOnWidget(delegate, keyval, modifiers)) return true;
    for (let widget: Gtk.Widget | null = element; widget; widget = widget.getParent()) {
        if (dispatchShortcutsOnWidget(widget, keyval, modifiers)) return true;
    }
    return false;
};

const applyKeyAction = async (
    element: Gtk.Widget,
    controller: Gtk.EventControllerKey,
    state: UserEventState,
    action: KeyAction,
): Promise<void> => {
    updateModifierState(state, action);
    const signalName = action.press ? "key-pressed" : "key-released";
    controller.emit(signalName, action.keyval, 0, state.modifierState);
    if (action.press) {
        const handled = dispatchShortcuts(element, action.keyval, state.modifierState);
        if (!handled && action.keyval === Gdk.KEY_Return && isEditable(element) && !(element instanceof Gtk.TextView)) {
            await fireEvent(element, "activate");
        }
    }
};

const keyboardWith =
    (state: UserEventState) =>
    async (element: Gtk.Widget, input: string): Promise<void> => {
        await act(async () => {
            const controller = getOrCreateController(element, Gtk.EventControllerKey);
            for (const action of parseKeyboardInput(input)) {
                await applyKeyAction(element, controller, state, action);
            }
        });
    };

const keyboard = (element: Gtk.Widget, input: string): Promise<void> =>
    keyboardWith(createInitialState())(element, input);

/**
 * Pointer input actions for simulating mouse interactions.
 *
 * - `"click"` or `"[MouseLeft]"`: Full click (press + release)
 * - `"down"` or `"[MouseLeft>]"`: Press and hold
 * - `"up"` or `"[/MouseLeft]"`: Release
 */
export type PointerInput = "click" | "down" | "up" | "[MouseLeft]" | "[MouseLeft>]" | "[/MouseLeft]";

const PRESS_INPUTS = new Set<PointerInput>(["[MouseLeft>]", "down"]);
const RELEASE_INPUTS = new Set<PointerInput>(["[/MouseLeft]", "up"]);
const CLICK_INPUTS = new Set<PointerInput>(["[MouseLeft]", "click"]);

const applyPointerInput = (controller: Gtk.GestureClick, state: UserEventState, input: PointerInput): void => {
    if (CLICK_INPUTS.has(input)) {
        controller.emit("pressed", 1, 0, 0);
        controller.emit("released", 1, 0, 0);
        state.mouseLeftDown = false;
        return;
    }
    if (PRESS_INPUTS.has(input) && !state.mouseLeftDown) {
        controller.emit("pressed", 1, 0, 0);
        state.mouseLeftDown = true;
        return;
    }
    if (RELEASE_INPUTS.has(input) && state.mouseLeftDown) {
        controller.emit("released", 1, 0, 0);
        state.mouseLeftDown = false;
    }
};

const pointerWith =
    (state: UserEventState) =>
    async (element: Gtk.Widget, input: PointerInput): Promise<void> => {
        await act(() => {
            const controller = getOrCreateController(element, Gtk.GestureClick);
            applyPointerInput(controller, state, input);
        });
    };

const pointer = (element: Gtk.Widget, input: PointerInput): Promise<void> =>
    pointerWith(createInitialState())(element, input);

const rotate = async (element: Gtk.Widget, angle: number, deltaAngle: number = angle): Promise<void> => {
    await act(() => {
        const controller = findController(element, Gtk.GestureRotate);
        controller.emit("angle-changed", angle, deltaAngle);
    });
};

const zoom = async (element: Gtk.Widget, scale: number): Promise<void> => {
    await act(() => {
        const controller = findController(element, Gtk.GestureZoom);
        controller.emit("scale-changed", scale);
    });
};

const swipe = async (element: Gtk.Widget, velocityX: number, velocityY: number): Promise<void> => {
    await act(() => {
        const controller = findController(element, Gtk.GestureSwipe);
        controller.emit("swipe", velocityX, velocityY);
    });
};

const longPress = async (element: Gtk.Widget, x: number = 0, y: number = 0): Promise<void> => {
    await act(() => {
        const controller = findController(element, Gtk.GestureLongPress);
        controller.emit("pressed", x, y);
    });
};

/**
 * Options for {@link userEvent.drag}.
 */
export type DragOptions = {
    /** X coordinate where the drag begins, in widget-local pixels (default: 0). */
    startX?: number;
    /** Y coordinate where the drag begins, in widget-local pixels (default: 0). */
    startY?: number;
};

interface DragInstancePatch {
    getStartPoint?: () => [boolean, number, number];
    getOffset?: () => [boolean, number, number];
}

const withGestureDragState = <T>(
    controller: Gtk.GestureDrag,
    startX: number,
    startY: number,
    runWithOffset: (setOffset: (dx: number, dy: number) => void) => T,
): T => {
    const instance = controller as unknown as DragInstancePatch;
    const ownsStartPoint = Object.hasOwn(instance, "getStartPoint");
    const ownsOffset = Object.hasOwn(instance, "getOffset");
    const previousStartPoint = instance.getStartPoint;
    const previousOffset = instance.getOffset;
    let offsetX = 0;
    let offsetY = 0;
    instance.getStartPoint = () => [true, startX, startY];
    instance.getOffset = () => [true, offsetX, offsetY];
    const setOffset = (dx: number, dy: number): void => {
        offsetX = dx;
        offsetY = dy;
    };
    try {
        return runWithOffset(setOffset);
    } finally {
        if (ownsStartPoint) instance.getStartPoint = previousStartPoint;
        else delete instance.getStartPoint;
        if (ownsOffset) instance.getOffset = previousOffset;
        else delete instance.getOffset;
    }
};

const drag = async (element: Gtk.Widget, dx: number, dy: number, options: DragOptions = {}): Promise<void> => {
    const startX = options.startX ?? 0;
    const startY = options.startY ?? 0;
    await act(() => {
        const controller = findController(element, Gtk.GestureDrag);
        withGestureDragState(controller, startX, startY, (setOffset) => {
            controller.emit("drag-begin", startX, startY);
            setOffset(dx, dy);
            controller.emit("drag-update", dx, dy);
            controller.emit("drag-end", dx, dy);
        });
    });
};

const drop = async (element: Gtk.Widget, content: DropContent, options: DropOptions = {}): Promise<void> => {
    await act(() => {
        const target = findController(element, Gtk.DropTarget);
        target.emit("drop", wrapValue(content), options.x ?? 0, options.y ?? 0);
    });
};

const dragAndDrop = async (
    source: Gtk.Widget,
    target: Gtk.Widget,
    content: DropContent,
    options: DropOptions = {},
): Promise<void> => {
    await act(() => {
        findController(source, Gtk.DragSource);
        const dropTarget = findController(target, Gtk.DropTarget);
        dropTarget.emit("drop", wrapValue(content), options.x ?? 0, options.y ?? 0);
    });
};

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
export const userEvent = {
    /**
     * Activates a widget.
     *
     * Uses GTK's native `Gtk.Widget.activate()` to trigger the widget's
     * default action — clicking buttons, toggling checkboxes/switches, etc.
     *
     * `Gtk.Button` (and subclasses) are special-cased to a synchronous
     * `pressed`/`released` click-gesture sequence instead, so the `clicked`
     * signal fires immediately rather than behind GtkButton's unconditional
     * 250ms keyboard-activation timeout, which races test wait windows under
     * load.
     */
    click,
    /**
     * Double-clicks a widget.
     *
     * Emits pressed/released signals with n_press=1, then n_press=2.
     */
    dblClick,
    /**
     * Triple-clicks a widget.
     *
     * Emits pressed/released signals with n_press=1, 2, then 3. Useful for text selection.
     */
    tripleClick,
    /**
     * Simulates Tab key navigation.
     *
     * @param element - Starting element
     * @param options - Use `shift: true` for backwards navigation
     */
    tab,
    /**
     * Types text into an editable widget.
     *
     * Appends text to the current content. Works with Entry, SearchEntry,
     * and SpinButton widgets.
     *
     * @param element - The editable widget
     * @param text - Text to type
     */
    type,
    /**
     * Clears an editable widget's content.
     *
     * Sets the text to empty string.
     */
    clear,
    /**
     * Selects options in a dropdown or list.
     *
     * Works with DropDown, ComboBox, ListBox, ListView, GridView, and ColumnView.
     *
     * @param element - The selectable widget
     * @param values - Index or array of indices to select
     */
    selectOptions,
    /**
     * Deselects options in a list.
     *
     * Works with ListBox and multi-selection list views.
     *
     * @param element - The selectable widget
     * @param values - Index or array of indices to deselect
     */
    deselectOptions,
    /**
     * Simulates mouse entering a widget (hover).
     *
     * Triggers the "enter" signal on the widget's EventControllerMotion.
     */
    hover,
    /**
     * Simulates mouse leaving a widget (unhover).
     *
     * Triggers the "leave" signal on the widget's EventControllerMotion.
     */
    unhover,
    /**
     * Simulates keyboard input.
     *
     * Supports special keys in braces: `{Enter}`, `{Tab}`, `{Escape}`, etc.
     * Use `{Key>}` to hold a key down, `{/Key}` to release.
     *
     * @example
     * ```tsx
     * await userEvent.keyboard(element, "hello");
     * await userEvent.keyboard(element, "{Enter}");
     * await userEvent.keyboard(element, "{Shift>}A{/Shift}");
     * ```
     */
    keyboard,
    /**
     * Simulates pointer (mouse) input.
     *
     * Supports: `"click"`, `"[MouseLeft]"`, `"down"`, `"up"`.
     *
     * @example
     * ```tsx
     * await userEvent.pointer(element, "click");
     * await userEvent.pointer(element, "[MouseLeft]");
     * ```
     */
    pointer,
    /**
     * Simulates a rotate gesture on a widget.
     *
     * Locates the widget's `Gtk.GestureRotate` controller and emits
     * `angle-changed` with the given absolute and delta angles in radians.
     * Throws if the widget has no `GestureRotate` controller attached.
     *
     * @param element - The widget receiving the gesture
     * @param angle - Absolute rotation angle in radians
     * @param deltaAngle - Angle delta since gesture start, in radians (default: `angle`)
     */
    rotate,
    /**
     * Simulates a pinch-zoom gesture on a widget.
     *
     * Locates the widget's `Gtk.GestureZoom` controller and emits
     * `scale-changed` with the given scale factor. Throws if the widget
     * has no `GestureZoom` controller attached.
     *
     * @param element - The widget receiving the gesture
     * @param scale - The new scale factor (1 = no zoom)
     */
    zoom,
    /**
     * Simulates a swipe gesture on a widget.
     *
     * Locates the widget's `Gtk.GestureSwipe` controller and emits `swipe`
     * with the supplied velocity vector. Throws if the widget has no
     * `GestureSwipe` controller attached.
     *
     * @param element - The widget receiving the gesture
     * @param velocityX - Horizontal velocity in pixels per second
     * @param velocityY - Vertical velocity in pixels per second
     */
    swipe,
    /**
     * Simulates a long-press gesture on a widget.
     *
     * Locates the widget's `Gtk.GestureLongPress` controller and emits
     * `pressed` at the supplied coordinates. Throws if the widget has no
     * `GestureLongPress` controller attached.
     *
     * @param element - The widget receiving the gesture
     * @param x - X coordinate in widget-local pixels (default: 0)
     * @param y - Y coordinate in widget-local pixels (default: 0)
     */
    longPress,
    /**
     * Simulates a click-drag gesture on a widget.
     *
     * Locates the widget's `Gtk.GestureDrag` controller and emits the
     * `drag-begin` → `drag-update` → `drag-end` sequence with the supplied
     * offset. Throws if the widget has no `GestureDrag` controller attached.
     *
     * @param element - The widget receiving the gesture
     * @param dx - Horizontal offset from the gesture origin
     * @param dy - Vertical offset from the gesture origin
     */
    drag,
    /**
     * Simulates a drop onto a widget's `Gtk.DropTarget`.
     *
     * Wraps the supplied content in a `GObject.Value` (strings → `G_TYPE_STRING`,
     * numbers → `G_TYPE_DOUBLE`, booleans → `G_TYPE_BOOLEAN`; pre-constructed
     * `GObject.Value` instances are forwarded unchanged) and emits `drop`.
     * Throws if the widget has no `DropTarget` controller attached.
     *
     * @param element - The drop target widget
     * @param content - Payload value (auto-marshalled or a pre-built GObject.Value)
     * @param options - Drop coordinates relative to the widget
     */
    drop,
    /**
     * Simulates dragging from one widget and dropping on another.
     *
     * Verifies the source widget has a `Gtk.DragSource` controller, then
     * fires a `drop` on the target widget's `Gtk.DropTarget` with the
     * supplied content. Throws if either controller is missing.
     *
     * @param source - Widget that initiates the drag
     * @param target - Widget that receives the drop
     * @param content - Payload value (auto-marshalled or a pre-built GObject.Value)
     * @param options - Drop coordinates relative to the target
     */
    dragAndDrop,
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
    setup: (): UserEventInstance => {
        const state = createInitialState();
        return {
            click,
            dblClick,
            tripleClick,
            tab,
            type,
            clear,
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
            keyboard: keyboardWith(state),
            pointer: pointerWith(state),
        };
    },
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
    keyboard: (element: Gtk.Widget, input: string) => Promise<void>;
    pointer: (element: Gtk.Widget, input: PointerInput) => Promise<void>;
};
