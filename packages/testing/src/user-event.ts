import { getInterface } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import {
    Accessible,
    AccessibleRole,
    type CheckButton,
    type ComboBox,
    DirectionType,
    type DropDown,
    Editable,
    type ListBox,
    type ListBoxRow,
    type Switch,
    type ToggleButton,
    Widget,
} from "@gtkx/ffi/gtk";
import { fireEvent } from "./fire-event.js";
import { tick } from "./timing.js";
import { isEditable } from "./widget.js";

/**
 * Options for the tab user event.
 */
export interface TabOptions {
    /** If true, navigates backwards (Shift+Tab behavior). */
    shift?: boolean;
}

const TOGGLEABLE_ROLES = new Set([
    AccessibleRole.CHECKBOX,
    AccessibleRole.RADIO,
    AccessibleRole.TOGGLE_BUTTON,
    AccessibleRole.SWITCH,
]);

const isToggleable = (widget: Gtk.Widget): boolean => {
    const accessible = getInterface(widget, Accessible);
    if (!accessible) return false;
    return TOGGLEABLE_ROLES.has(accessible.getAccessibleRole());
};

const click = async (element: Gtk.Widget): Promise<void> => {
    if (isToggleable(element)) {
        const role = getInterface(element, Accessible)?.getAccessibleRole();

        if (role === AccessibleRole.CHECKBOX || role === AccessibleRole.RADIO) {
            const checkButton = element as CheckButton;
            checkButton.setActive(!checkButton.getActive());
        } else if (role === AccessibleRole.SWITCH) {
            const switchWidget = element as Switch;
            switchWidget.setActive(!switchWidget.getActive());
        } else {
            const toggleButton = element as ToggleButton;
            toggleButton.setActive(!toggleButton.getActive());
        }

        await tick();
    } else {
        await fireEvent(element, "clicked");
    }
};

const dblClick = async (element: Gtk.Widget): Promise<void> => {
    await fireEvent(element, "clicked");
    await fireEvent(element, "clicked");
};

const tripleClick = async (element: Gtk.Widget): Promise<void> => {
    await fireEvent(element, "clicked");
    await fireEvent(element, "clicked");
    await fireEvent(element, "clicked");
};

const activate = async (element: Gtk.Widget): Promise<void> => {
    element.activate();
    await tick();
};

const tab = async (element: Gtk.Widget, options?: TabOptions): Promise<void> => {
    const direction = options?.shift ? DirectionType.TAB_BACKWARD : DirectionType.TAB_FORWARD;
    const root = element.getRoot();

    if (root) {
        getInterface(root, Widget)?.childFocus(direction);
    }

    await tick();
};

const type = async (element: Gtk.Widget, text: string): Promise<void> => {
    if (!isEditable(element)) {
        throw new Error("Cannot type into element: element is not editable (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)");
    }

    const editable = getInterface(element, Editable);
    if (!editable) return;

    const currentText = editable.getText();
    editable.setText(currentText + text);

    await tick();
};

const clear = async (element: Gtk.Widget): Promise<void> => {
    if (!isEditable(element)) {
        throw new Error("Cannot clear element: element is not editable (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)");
    }

    getInterface(element, Editable)?.setText("");
    await tick();
};

const SELECTABLE_ROLES = new Set([AccessibleRole.COMBO_BOX, AccessibleRole.LIST]);

const isSelectable = (widget: Gtk.Widget): boolean => {
    const accessible = getInterface(widget, Accessible);
    if (!accessible) return false;
    return SELECTABLE_ROLES.has(accessible.getAccessibleRole());
};

const selectOptions = async (element: Gtk.Widget, values: string | string[] | number | number[]): Promise<void> => {
    if (!isSelectable(element)) {
        throw new Error("Cannot select options: element is not a selectable widget (COMBO_BOX or LIST)");
    }

    const role = getInterface(element, Accessible)?.getAccessibleRole();
    const valueArray = Array.isArray(values) ? values : [values];

    if (role === AccessibleRole.COMBO_BOX) {
        if (valueArray.length > 1) {
            throw new Error("Cannot select multiple options on a ComboBox/DropDown");
        }

        const value = valueArray[0];

        if (typeof value !== "number") {
            throw new Error("ComboBox/DropDown selection requires a numeric index");
        }

        const isDropDown = element.constructor.name === "DropDown";

        if (isDropDown) {
            (element as DropDown).setSelected(value);
        } else {
            (element as ComboBox).setActive(value);
        }
    } else if (role === AccessibleRole.LIST) {
        const listBox = element as ListBox;

        for (const value of valueArray) {
            if (typeof value !== "number") {
                throw new Error("ListBox selection requires numeric indices");
            }

            const row = listBox.getRowAtIndex(value);

            if (row) {
                listBox.selectRow(row);
            }
        }
    }

    await tick();
};

const deselectOptions = async (element: Gtk.Widget, values: number | number[]): Promise<void> => {
    const role = getInterface(element, Accessible)?.getAccessibleRole();

    if (role !== AccessibleRole.LIST) {
        throw new Error("Cannot deselect options: only ListBox supports deselection");
    }

    const listBox = element as ListBox;
    const valueArray = Array.isArray(values) ? values : [values];

    for (const value of valueArray) {
        const row = listBox.getRowAtIndex(value);

        if (row) {
            listBox.unselectRow(row as ListBoxRow);
        }
    }

    await tick();
};

/**
 * Simulates user interactions with GTK widgets. Provides methods that mimic
 * real user behavior like clicking, typing, and clearing input fields.
 */
export const userEvent = {
    click,
    dblClick,
    tripleClick,
    activate,
    tab,
    type,
    clear,
    selectOptions,
    deselectOptions,
};
