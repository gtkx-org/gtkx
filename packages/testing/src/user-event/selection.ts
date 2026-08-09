import * as Gtk from "@gtkx/gi/gtk";
import { formatRoleList } from "../role-helpers.js";
import { getWidgetMethod } from "../widget-getters.js";
import { wrapEvent } from "./event-wrapper.js";
import {
    getChildAtIndex,
    hasIndexedChildren,
    isChildSelected,
    selectContainerChild,
    unselectContainerChild,
} from "./indexed-children.js";

type CollectionWidget = Gtk.ListView | Gtk.GridView | Gtk.ColumnView;
type IndexedChildAction = (container: Gtk.Widget, child: Gtk.Widget) => void;

const SELECTABLE_ROLES: Set<Gtk.AccessibleRole> = new Set([
    Gtk.AccessibleRole.COMBO_BOX,
    Gtk.AccessibleRole.GRID,
    Gtk.AccessibleRole.LIST,
]);

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

const getIndexSelector = (widget: Gtk.Widget): ((position: number) => void) | null => {
    const fn = getWidgetMethod(widget, "setSelected");

    return typeof fn === "function" ? (fn as (position: number) => void).bind(widget) : null;
};

const selectDropDownOption = (widget: Gtk.Widget, valueArray: number[]): void => {
    const setSelected = getIndexSelector(widget);

    if (!setSelected) {
        throw new TypeError("Cannot select options: the COMBO_BOX role needs a widget exposing setSelected");
    }

    if (valueArray.length > 1) {
        throw new Error("Cannot select multiple options: a drop-down only supports single selection");
    }

    const [selection] = valueArray;

    if (selection !== undefined) {
        setSelected(selection);
    }
};

const selectChildRow = (container: Gtk.Widget, child: Gtk.Widget): void => {
    selectContainerChild(container, child);
};

const unselectChildRow = (container: Gtk.Widget, child: Gtk.Widget): void => {
    if (isChildSelected(child)) {
        unselectContainerChild(container, child);
    }
};

const applyIndexedChildren = (widget: Gtk.Widget, valueArray: number[], apply: IndexedChildAction): void => {
    for (const value of valueArray) {
        const child = getChildAtIndex(widget, value);

        if (child) {
            apply(widget, child);
        }
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
        selectDropDownOption(widget, valueArray);

        return;
    }

    if (!hasIndexedChildren(widget)) {
        throw new TypeError("Cannot select options: the widget exposes no children to select by index");
    }

    applyIndexedChildren(widget, valueArray, selectChildRow);
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
 * by setting the selected position of a widget with the COMBO_BOX role, or by selecting the indexed
 * children of a list box or flow box through their container. An empty array clears a view's
 * selection. The children are never activated, so no row-activated handler runs.
 *
 * @throws When a view has no selection model, when a COMBO_BOX-role widget is given more than one
 * position or exposes no `setSelected`, or when the widget's role is none of COMBO_BOX, GRID, or
 * LIST.
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
    if (!hasIndexedChildren(widget)) {
        throw new TypeError("Cannot deselect options: the widget exposes no children to deselect by index");
    }

    applyIndexedChildren(widget, valueArray, unselectChildRow);
};

/**
 * Unselects the items at the given positions in a list, grid, or column view, or unselects the
 * indexed children of a list box or flow box through their container. A child that is not selected
 * is left alone, and no child is activated.
 *
 * @throws When a view has no selection model, or when the widget exposes no indexed children.
 */
const deselectOptions = (widget: Gtk.Widget, values: number | number[]): Promise<void> =>
    runSelectionEvent(widget, values, deselectInListView, deselectByRole);

export { selectOptions, deselectOptions };
