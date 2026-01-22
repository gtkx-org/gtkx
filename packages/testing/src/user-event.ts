import { getNativeObject } from "@gtkx/ffi";
import * as Gdk from "@gtkx/ffi/gdk";
import { type GObject, signalEmitv, signalLookup, typeFromName, Value } from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "./fire-event.js";
import { tick } from "./timing.js";
import { isEditable } from "./widget.js";

/**
 * Options for tab navigation.
 */
export type TabOptions = {
    /** Navigate backwards (Shift+Tab) instead of forwards */
    shift?: boolean;
};

const TOGGLEABLE_ROLES = new Set([
    Gtk.AccessibleRole.CHECKBOX,
    Gtk.AccessibleRole.RADIO,
    Gtk.AccessibleRole.TOGGLE_BUTTON,
    Gtk.AccessibleRole.SWITCH,
]);

const isToggleable = (widget: Gtk.Widget): boolean => {
    return TOGGLEABLE_ROLES.has(widget.getAccessibleRole());
};

const click = async (element: Gtk.Widget): Promise<void> => {
    if (isToggleable(element)) {
        const role = element.getAccessibleRole();

        if (role === Gtk.AccessibleRole.CHECKBOX || role === Gtk.AccessibleRole.RADIO) {
            const checkButton = element as Gtk.CheckButton;
            checkButton.setActive(!checkButton.getActive());
        } else if (role === Gtk.AccessibleRole.SWITCH) {
            const switchWidget = element as Gtk.Switch;
            switchWidget.setActive(!switchWidget.getActive());
        } else {
            const toggleButton = element as Gtk.ToggleButton;
            toggleButton.setActive(!toggleButton.getActive());
        }

        await tick();
    } else {
        await fireEvent(element, "clicked");
    }
};

const emitClickSequence = async (element: Gtk.Widget, nPress: number): Promise<void> => {
    const controller = getOrCreateController(element, Gtk.GestureClick);

    for (let i = 1; i <= nPress; i++) {
        const args = [
            Value.newFromObject(controller),
            Value.newFromInt(i),
            Value.newFromDouble(0),
            Value.newFromDouble(0),
        ];
        signalEmitv(args, getSignalId(controller, "pressed"), 0, null);
        signalEmitv(args, getSignalId(controller, "released"), 0, null);
    }

    await tick();
};

const dblClick = async (element: Gtk.Widget): Promise<void> => {
    await emitClickSequence(element, 2);
};

const tripleClick = async (element: Gtk.Widget): Promise<void> => {
    await emitClickSequence(element, 3);
};

const tab = async (element: Gtk.Widget, options?: TabOptions): Promise<void> => {
    const direction = options?.shift ? Gtk.DirectionType.TAB_BACKWARD : Gtk.DirectionType.TAB_FORWARD;
    const root = element.getRoot();

    if (root) {
        (getNativeObject(root.handle) as Gtk.Widget).childFocus(direction);
    }

    await tick();
};

const type = async (element: Gtk.Widget, text: string): Promise<void> => {
    if (!isEditable(element)) {
        throw new Error("Cannot type into element: expected editable widget (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)");
    }

    const editable = getNativeObject(element.handle, Gtk.Editable);
    const currentText = editable.getText();
    editable.setText(currentText + text);

    await tick();
};

const clear = async (element: Gtk.Widget): Promise<void> => {
    if (!isEditable(element)) {
        throw new Error("Cannot clear element: expected editable widget (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)");
    }

    getNativeObject(element.handle, Gtk.Editable)?.setText("");
    await tick();
};

const SELECTABLE_ROLES = new Set([Gtk.AccessibleRole.COMBO_BOX, Gtk.AccessibleRole.LIST]);

const isSelectable = (widget: Gtk.Widget): boolean => {
    if (!widget) return false;
    return SELECTABLE_ROLES.has(widget.getAccessibleRole());
};

const selectListViewItems = (selectionModel: Gtk.SelectionModel, positions: number[], exclusive: boolean): void => {
    if (positions.length === 0) {
        selectionModel.unselectRange(0, selectionModel.getNItems());
        return;
    }

    if (exclusive && positions.length === 1) {
        selectionModel.selectItem(positions[0] as number, true);
        return;
    }

    const nItems = selectionModel.getNItems();
    const selected = new Gtk.Bitset();
    const mask = Gtk.Bitset.newRange(0, nItems);

    for (const pos of positions) {
        selected.add(pos);
    }

    selectionModel.setSelection(selected, mask);
};

const isListView = (widget: Gtk.Widget): widget is Gtk.ListView | Gtk.GridView | Gtk.ColumnView => {
    return widget instanceof Gtk.ListView || widget instanceof Gtk.GridView || widget instanceof Gtk.ColumnView;
};

const selectOptions = async (element: Gtk.Widget, values: number | number[]): Promise<void> => {
    const valueArray = Array.isArray(values) ? values : [values];

    if (isListView(element)) {
        const selectionModel = element.getModel() as Gtk.SelectionModel;
        const isMultiSelection = selectionModel instanceof Gtk.MultiSelection;
        selectListViewItems(selectionModel, valueArray, !isMultiSelection);
        await tick();
        return;
    }

    if (!isSelectable(element)) {
        throw new Error("Cannot select options: expected selectable widget (COMBO_BOX or LIST)");
    }

    const role = element.getAccessibleRole();

    if (role === Gtk.AccessibleRole.COMBO_BOX) {
        if (Array.isArray(values) && values.length > 1) {
            throw new Error("Cannot select multiple options: ComboBox only supports single selection");
        }
        if (element instanceof Gtk.DropDown) {
            (element as Gtk.DropDown).setSelected(valueArray[0] as number);
        } else {
            (element as Gtk.ComboBox).setActive(valueArray[0] as number);
        }
    } else if (role === Gtk.AccessibleRole.LIST) {
        const listBox = element as Gtk.ListBox;

        for (const value of valueArray) {
            const row = listBox.getRowAtIndex(value);

            if (row) {
                listBox.selectRow(row);
                row.activate();
            }
        }
    }

    await tick();
};

const deselectOptions = async (element: Gtk.Widget, values: number | number[]): Promise<void> => {
    const valueArray = Array.isArray(values) ? values : [values];

    if (isListView(element)) {
        const selectionModel = element.getModel() as Gtk.SelectionModel;

        for (const pos of valueArray) {
            selectionModel.unselectItem(pos);
        }

        await tick();
        return;
    }

    const role = element.getAccessibleRole();

    if (role !== Gtk.AccessibleRole.LIST) {
        throw new Error("Cannot deselect options: only ListBox supports deselection");
    }

    const listBox = element as Gtk.ListBox;

    for (const value of valueArray) {
        const row = listBox.getRowAtIndex(value);

        if (row) {
            listBox.unselectRow(row as Gtk.ListBoxRow);
        }
    }

    await tick();
};

const getOrCreateController = <T extends Gtk.EventController>(element: Gtk.Widget, controllerType: new () => T): T => {
    const controllers = element.observeControllers();
    const nItems = controllers.getNItems();

    for (let i = 0; i < nItems; i++) {
        const controller = controllers.getObject(i);
        if (controller instanceof controllerType) {
            return controller as T;
        }
    }

    const controller = new controllerType();
    element.addController(controller);
    return controller;
};

const getSignalId = (target: Gtk.EventController, signalName: string): number => {
    const gtype = typeFromName((target.constructor as typeof GObject).glibTypeName);
    return signalLookup(signalName, gtype);
};

const hover = async (element: Gtk.Widget): Promise<void> => {
    const controller = getOrCreateController(element, Gtk.EventControllerMotion);
    signalEmitv(
        [Value.newFromObject(controller), Value.newFromDouble(0), Value.newFromDouble(0)],
        getSignalId(controller, "enter"),
        0,
        null,
    );
    await tick();
};

const unhover = async (element: Gtk.Widget): Promise<void> => {
    const controller = getOrCreateController(element, Gtk.EventControllerMotion);
    signalEmitv([Value.newFromObject(controller)], getSignalId(controller, "leave"), 0, null);
    await tick();
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
};

const parseKeyboardInput = (input: string): Array<{ keyval: number; press: boolean }> => {
    const actions: Array<{ keyval: number; press: boolean }> = [];
    let i = 0;

    while (i < input.length) {
        if (input[i] === "{") {
            const endBrace = input.indexOf("}", i);
            if (endBrace === -1) break;

            let keyName = input.slice(i + 1, endBrace);
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
            if (press) actions.push({ keyval, press: true });
            if (release) actions.push({ keyval, press: false });

            i = endBrace + 1;
        } else {
            const keyval = input.charCodeAt(i);
            actions.push({ keyval, press: true });
            actions.push({ keyval, press: false });
            i++;
        }
    }

    return actions;
};

let gdkModifierType: number | null = null;

const keyboard = async (element: Gtk.Widget, input: string): Promise<void> => {
    gdkModifierType ??= typeFromName("GdkModifierType");
    const controller = getOrCreateController(element, Gtk.EventControllerKey);
    const actions = parseKeyboardInput(input);

    for (const action of actions) {
        const signalName = action.press ? "key-pressed" : "key-released";
        const returnValue = action.press ? Value.newFromBoolean(false) : null;
        signalEmitv(
            [
                Value.newFromObject(controller),
                Value.newFromUint(action.keyval),
                Value.newFromUint(0),
                Value.newFromFlags(gdkModifierType, 0),
            ],
            getSignalId(controller, signalName),
            0,
            returnValue,
        );

        if (action.press && action.keyval === Gdk.KEY_Return && isEditable(element)) {
            await fireEvent(element, "activate");
        }
    }

    await tick();
};

/**
 * Pointer input actions for simulating mouse interactions.
 *
 * - `"click"` or `"[MouseLeft]"`: Full click (press + release)
 * - `"down"` or `"[MouseLeft>]"`: Press and hold
 * - `"up"` or `"[/MouseLeft]"`: Release
 */
export type PointerInput = "click" | "down" | "up" | "[MouseLeft]" | "[MouseLeft>]" | "[/MouseLeft]";

const pointer = async (element: Gtk.Widget, input: PointerInput): Promise<void> => {
    const controller = getOrCreateController(element, Gtk.GestureClick);
    const pressedArgs = [
        Value.newFromObject(controller),
        Value.newFromInt(1),
        Value.newFromDouble(0),
        Value.newFromDouble(0),
    ];
    const releasedArgs = [
        Value.newFromObject(controller),
        Value.newFromInt(1),
        Value.newFromDouble(0),
        Value.newFromDouble(0),
    ];

    if (input === "[MouseLeft]" || input === "click") {
        signalEmitv(pressedArgs, getSignalId(controller, "pressed"), 0, null);
        signalEmitv(releasedArgs, getSignalId(controller, "released"), 0, null);
    } else if (input === "[MouseLeft>]" || input === "down") {
        signalEmitv(pressedArgs, getSignalId(controller, "pressed"), 0, null);
    } else if (input === "[/MouseLeft]" || input === "up") {
        signalEmitv(releasedArgs, getSignalId(controller, "released"), 0, null);
    }

    await tick();
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
     * Clicks or toggles a widget.
     *
     * For toggleable widgets (checkboxes, switches, toggle buttons),
     * toggles the active state. For buttons, emits clicked signal.
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
};
