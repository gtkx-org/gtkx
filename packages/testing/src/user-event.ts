import { getNativeObject } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "./fire-event.js";
import { tick } from "./timing.js";
import { isEditable } from "./widget.js";

export type TabOptions = {

    shift?: boolean;
};

const TOGGLEABLE_ROLES = new Set([
    Gtk.AccessibleRole.CHECKBOX,
    Gtk.AccessibleRole.RADIO,
    Gtk.AccessibleRole.TOGGLE_BUTTON,
    Gtk.AccessibleRole.SWITCH,
]);

const isToggleable = (widget: Gtk.Widget): boolean => {
    const accessible = getNativeObject(widget.id, Gtk.Accessible);
    if (!accessible) return false;
    return TOGGLEABLE_ROLES.has(accessible.getAccessibleRole());
};

const click = async (element: Gtk.Widget): Promise<void> => {
    if (isToggleable(element)) {
        const role = getNativeObject(element.id, Gtk.Accessible)?.getAccessibleRole();

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
    const direction = options?.shift ? Gtk.DirectionType.TAB_BACKWARD : Gtk.DirectionType.TAB_FORWARD;
    const root = element.getRoot();

    if (root) {
        (getNativeObject(root.id) as Gtk.Widget).childFocus(direction);
    }

    await tick();
};

const type = async (element: Gtk.Widget, text: string): Promise<void> => {
    if (!isEditable(element)) {
        throw new Error("Cannot type into element: expected editable widget (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)");
    }

    const editable = getNativeObject(element.id, Gtk.Editable);
    if (!editable) return;

    const currentText = editable.getText();
    editable.setText(currentText + text);

    await tick();
};

const clear = async (element: Gtk.Widget): Promise<void> => {
    if (!isEditable(element)) {
        throw new Error("Cannot clear element: expected editable widget (TEXT_BOX, SEARCH_BOX, or SPIN_BUTTON)");
    }

    getNativeObject(element.id, Gtk.Editable)?.setText("");
    await tick();
};

const SELECTABLE_ROLES = new Set([Gtk.AccessibleRole.COMBO_BOX, Gtk.AccessibleRole.LIST]);

const isSelectable = (widget: Gtk.Widget): boolean => {
    const accessible = getNativeObject(widget.id, Gtk.Accessible);
    if (!accessible) return false;
    return SELECTABLE_ROLES.has(accessible.getAccessibleRole());
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

    const role = getNativeObject(element.id, Gtk.Accessible)?.getAccessibleRole();

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

    const role = getNativeObject(element.id, Gtk.Accessible)?.getAccessibleRole();

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
