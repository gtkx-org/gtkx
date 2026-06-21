import * as Gtk from "@gtkx/gi/gtk";
import { runInAct } from "./dispatch.js";
import { formatRoleList } from "./role-helpers.js";

const SELECTABLE_ROLES = new Set<Gtk.AccessibleRole>([Gtk.AccessibleRole.COMBO_BOX, Gtk.AccessibleRole.LIST]);

const isSelectable = (widget: Gtk.Widget): boolean => {
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

const selectComboBoxOption = (widget: Gtk.Widget, valueArray: number[]): void => {
    if (valueArray.length > 1) {
        throw new Error("Cannot select multiple options: ComboBox only supports single selection");
    }
    const [selection] = valueArray;
    if (selection === undefined) return;
    if (widget instanceof Gtk.DropDown) {
        widget.setSelected(selection);
    } else if (widget instanceof Gtk.ComboBox) {
        widget.setActive(selection);
    }
};

const applyListBoxRows = (listBox: Gtk.ListBox, valueArray: number[], select: boolean): void => {
    for (const value of valueArray) {
        const row = listBox.getRowAtIndex(value);
        if (!row) continue;
        if (select) {
            listBox.selectRow(row);
            row.activate();
        } else {
            listBox.unselectRow(row);
        }
    }
};

const requireSelectionModel = (
    widget: Gtk.ListView | Gtk.GridView | Gtk.ColumnView,
    verb: string,
): Gtk.SelectionModel => {
    const selectionModel = widget.getModel();
    if (selectionModel === null) {
        throw new Error(`Cannot ${verb} options: list view has no selection model`);
    }
    return selectionModel;
};

const selectInListView = (widget: Gtk.ListView | Gtk.GridView | Gtk.ColumnView, valueArray: number[]): void => {
    const selectionModel = requireSelectionModel(widget, "select");
    const isMultiSelection = selectionModel instanceof Gtk.MultiSelection;
    selectListViewItems(selectionModel, valueArray, !isMultiSelection);
};

const selectByRole = (widget: Gtk.Widget, valueArray: number[]): void => {
    if (!isSelectable(widget)) {
        throw new Error(`Cannot select options: expected selectable widget (${formatRoleList(SELECTABLE_ROLES)})`);
    }

    const role = widget.getAccessibleRole();
    if (role === Gtk.AccessibleRole.COMBO_BOX) {
        selectComboBoxOption(widget, valueArray);
    } else if (widget instanceof Gtk.ListBox) {
        applyListBoxRows(widget, valueArray, true);
    }
};

export const selectOptions = (widget: Gtk.Widget, values: number | number[]): Promise<void> =>
    runInAct(() => {
        const valueArray = Array.isArray(values) ? values : [values];
        if (isListView(widget)) {
            selectInListView(widget, valueArray);
            return;
        }
        selectByRole(widget, valueArray);
    });

const deselectInListView = (widget: Gtk.ListView | Gtk.GridView | Gtk.ColumnView, valueArray: number[]): void => {
    const selectionModel = requireSelectionModel(widget, "deselect");
    for (const pos of valueArray) {
        selectionModel.unselectItem(pos);
    }
};

export const deselectOptions = (widget: Gtk.Widget, values: number | number[]): Promise<void> =>
    runInAct(() => {
        const valueArray = Array.isArray(values) ? values : [values];
        if (isListView(widget)) {
            deselectInListView(widget, valueArray);
            return;
        }
        if (!(widget instanceof Gtk.ListBox)) {
            throw new Error("Cannot deselect options: only ListBox supports deselection");
        }
        applyListBoxRows(widget, valueArray, false);
    });
