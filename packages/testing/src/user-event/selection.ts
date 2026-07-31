import * as Gtk from "@gtkx/gi/gtk";
import { formatRoleList } from "../role-helpers.js";
import { wrapEvent } from "./event-wrapper.js";

type CollectionWidget = Gtk.ListView | Gtk.GridView | Gtk.ColumnView;
type ListBoxRowAction = (listBox: Gtk.ListBox, row: Gtk.ListBoxRow) => void;

const SELECTABLE_ROLES: Set<Gtk.AccessibleRole> = new Set([Gtk.AccessibleRole.COMBO_BOX, Gtk.AccessibleRole.LIST]);

const isSelectable = (widget: Gtk.Widget): boolean => {
    return SELECTABLE_ROLES.has(widget.getAccessibleRole());
};

const selectListViewItems = (
    selectionModel: Gtk.SelectionModel,
    positions: number[],
    isExclusive: boolean,
): void => {
    if (positions.length === 0) {
        selectionModel.unselectRange(0, selectionModel.getNItems());

        return;
    }

    const [first] = positions;

    if (isExclusive && first !== undefined && positions.length === 1) {
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

const isListView = (widget: Gtk.Widget): widget is CollectionWidget =>
    widget instanceof Gtk.ListView || widget instanceof Gtk.GridView || widget instanceof Gtk.ColumnView;

const selectComboBoxOption = (widget: Gtk.Widget, valueArray: number[]): void => {
    if (valueArray.length > 1) {
        throw new Error("Cannot select multiple options: ComboBox only supports single selection");
    }

    const [selection] = valueArray;

    if (selection === undefined) {
        return;
    }

    if (widget instanceof Gtk.DropDown) {
        widget.setSelected(selection);
    } else if (widget instanceof Gtk.ComboBox) {
        widget.setActive(selection);
    }
};

const selectListBoxRow = (listBox: Gtk.ListBox, row: Gtk.ListBoxRow): void => {
    listBox.selectRow(row);
    row.activate();
};

const unselectListBoxRow = (listBox: Gtk.ListBox, row: Gtk.ListBoxRow): void => {
    listBox.unselectRow(row);
};

const applyListBoxRows = (listBox: Gtk.ListBox, valueArray: number[], apply: ListBoxRowAction): void => {
    for (const value of valueArray) {
        const row = listBox.getRowAtIndex(value);

        if (!row) {
            continue;
        }

        apply(listBox, row);
    }
};

const requireSelectionModel = (
    widget: CollectionWidget,
    verb: string,
): Gtk.SelectionModel => {
    const selectionModel = widget.getModel();

    if (selectionModel === null) {
        throw new Error(`Cannot ${verb} options: list view has no selection model`);
    }

    return selectionModel;
};

const selectInListView = (widget: CollectionWidget, valueArray: number[]): void => {
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
        applyListBoxRows(widget, valueArray, selectListBoxRow);
    }
};

const runSelectionEvent = (
    widget: Gtk.Widget,
    values: number | number[],
    inListView: (view: Gtk.ListView | Gtk.GridView | Gtk.ColumnView, valueArray: number[]) => void,
    byRole: (widget: Gtk.Widget, valueArray: number[]) => void,
): Promise<void> =>
    wrapEvent(widget, () => {
        const valueArray = Array.isArray(values) ? values : [values];

        if (isListView(widget)) {
            inListView(widget, valueArray);

            return;
        }

        byRole(widget, valueArray);
    });

/**
 * Selects the items at the given positions through a list, grid, or column view's selection model,
 * by setting the active item of a drop-down or combo box, or by selecting list box rows. An empty
 * array clears a view's selection.
 *
 * @throws When a view has no selection model, when a combo box is given more than one position, or
 * when the widget is neither a view nor something with the combo box or list role.
 */
const selectOptions = (widget: Gtk.Widget, values: number | number[]): Promise<void> =>
    runSelectionEvent(widget, values, selectInListView, selectByRole);

const deselectInListView = (widget: Gtk.ListView | Gtk.GridView | Gtk.ColumnView, valueArray: number[]): void => {
    const selectionModel = requireSelectionModel(widget, "deselect");

    for (const pos of valueArray) {
        selectionModel.unselectItem(pos);
    }
};

const deselectByRole = (widget: Gtk.Widget, valueArray: number[]): void => {
    if (!(widget instanceof Gtk.ListBox)) {
        throw new TypeError("Cannot deselect options: only ListBox supports deselection");
    }

    applyListBoxRows(widget, valueArray, unselectListBoxRow);
};

/**
 * Unselects the items at the given positions in a list, grid, or column view, or the rows at those
 * indices in a Gtk.ListBox.
 *
 * @throws When a view has no selection model, or when the widget is neither one of those views nor
 * a Gtk.ListBox.
 */
const deselectOptions = (widget: Gtk.Widget, values: number | number[]): Promise<void> =>
    runSelectionEvent(widget, values, deselectInListView, deselectByRole);

export { selectOptions, deselectOptions };
