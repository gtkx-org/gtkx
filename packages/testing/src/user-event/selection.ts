import * as Gtk from "@gtkx/gi/gtk";
import { formatRoleList } from "../role-helpers.js";
import { getCallableMethod } from "../widget-getters.js";
import { requireWidget } from "../widget-target.js";
import { wrapPointerEvent } from "./event-wrapper.js";
import {
    getChildAtIndex,
    hasIndexedChildren,
    isChildSelected,
    selectContainerChild,
    unselectContainerChild,
} from "./indexed-children.js";
import { usageError } from "../usage-error.js";

type CollectionWidget = Gtk.ListView | Gtk.GridView | Gtk.ColumnView;
type IndexedChildAction = (container: Gtk.Widget, child: Gtk.Widget) => void;

const SELECTABLE_ROLES: Set<Gtk.AccessibleRole> = new Set([
    Gtk.AccessibleRole.COMBO_BOX,
    Gtk.AccessibleRole.GRID,
    Gtk.AccessibleRole.LIST,
]);

const isSelectable = (widget: Gtk.Widget): boolean => SELECTABLE_ROLES.has(widget.getAccessibleRole());

const describeItems = (count: number): string => {
    if (count === 0) {
        return "no items";
    }

    return count === 1 ? "1 item, at position 0" : `${count} items, at positions 0 to ${count - 1}`;
};

const requirePositions = (values: readonly unknown[], count: number, verb: string): number[] =>
    values.map((value) => {
        if (typeof value !== "number" || !Number.isInteger(value)) {
            throw usageError(
                new TypeError(
                    `Cannot ${verb} options: expected item positions, got ${JSON.stringify(value)}. GTK drop-downs and lists have no option values, so pass the position of the item, such as 0 for the first one`,
                ),
            );
        }

        if (value < 0 || value >= count) {
            throw usageError(new RangeError(`Cannot ${verb} option ${value}: the widget has ${describeItems(count)}`));
        }

        return value;
    });

const selectListViewItems = (selectionModel: Gtk.SelectionModel, positions: number[], isExclusive: boolean): void => {
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

const getIndexSelector = (widget: Gtk.Widget): ((position: number) => void) | null =>
    getCallableMethod<[number], unknown>(widget, "setSelected");

const countModelItems = (widget: Gtk.Widget): number => {
    const model = getCallableMethod<[], unknown>(widget, "getModel")?.();

    if (typeof model !== "object" || model === null) {
        return 0;
    }

    return getCallableMethod<[], number>(model, "getNItems")?.() ?? 0;
};

const countIndexedChildren = (widget: Gtk.Widget): number => {
    let count = 0;

    while (getChildAtIndex(widget, count) !== null) {
        count++;
    }

    return count;
};

const selectDropDownOption = (widget: Gtk.Widget, valueArray: number[]): void => {
    const setSelected = getIndexSelector(widget);

    if (!setSelected) {
        throw usageError(
            new TypeError("Cannot select options: the COMBO_BOX role needs a widget exposing setSelected"),
        );
    }

    if (valueArray.length > 1) {
        throw usageError(new Error("Cannot select multiple options: a drop-down only supports single selection"));
    }

    const [selection] = requirePositions(valueArray, countModelItems(widget), "select");

    if (selection !== undefined) {
        setSelected(selection);
    }
};

const unselectChildRow = (container: Gtk.Widget, child: Gtk.Widget): void => {
    if (isChildSelected(child)) {
        unselectContainerChild(container, child);
    }
};

const applyIndexedChildren = (
    widget: Gtk.Widget,
    valueArray: number[],
    verb: string,
    apply: IndexedChildAction,
): void => {
    for (const value of requirePositions(valueArray, countIndexedChildren(widget), verb)) {
        const child = getChildAtIndex(widget, value);

        if (child) {
            apply(widget, child);
        }
    }
};

const requireSelectionModel = (widget: CollectionWidget, verb: string): Gtk.SelectionModel => {
    const selectionModel = widget.getModel();

    if (selectionModel === null) {
        throw usageError(new Error(`Cannot ${verb} options: list view has no selection model`));
    }

    return selectionModel;
};

const selectInListView = (widget: CollectionWidget, valueArray: number[]): void => {
    const selectionModel = requireSelectionModel(widget, "select");
    const isMultiSelection = selectionModel instanceof Gtk.MultiSelection;
    const positions = requirePositions(valueArray, selectionModel.getNItems(), "select");
    selectListViewItems(selectionModel, positions, !isMultiSelection);
};

const requireSelectableRole = (widget: Gtk.Widget, verb: string): void => {
    if (!isSelectable(widget)) {
        throw usageError(
            new Error(`Cannot ${verb} options: expected selectable widget (${formatRoleList(SELECTABLE_ROLES)})`),
        );
    }
};

const selectByRole = (widget: Gtk.Widget, valueArray: number[]): void => {
    requireSelectableRole(widget, "select");
    const role = widget.getAccessibleRole();

    if (role === Gtk.AccessibleRole.COMBO_BOX) {
        selectDropDownOption(widget, valueArray);

        return;
    }

    if (!hasIndexedChildren(widget)) {
        throw usageError(new TypeError("Cannot select options: the widget exposes no children to select by index"));
    }

    applyIndexedChildren(widget, valueArray, "select", selectContainerChild);
};

const runSelectionEvent = (
    widget: Gtk.Widget,
    values: number | number[],
    inListView: (view: Gtk.ListView | Gtk.GridView | Gtk.ColumnView, valueArray: number[]) => void,
    byRole: (widget: Gtk.Widget, valueArray: number[]) => void,
): Promise<void> =>
    wrapPointerEvent(widget, () => {
        const valueArray = Array.isArray(values) ? values : [values];

        if (isListView(widget)) {
            inListView(widget, valueArray);

            return;
        }

        byRole(widget, valueArray);
    });

/** Selects positions without activating them. */
const selectOptions = (widget: Gtk.Accessible, values: number | number[]): Promise<void> =>
    runSelectionEvent(requireWidget(widget), values, selectInListView, selectByRole);

const deselectInListView = (widget: Gtk.ListView | Gtk.GridView | Gtk.ColumnView, valueArray: number[]): void => {
    const selectionModel = requireSelectionModel(widget, "deselect");

    for (const pos of requirePositions(valueArray, selectionModel.getNItems(), "deselect")) {
        selectionModel.unselectItem(pos);
    }
};

const deselectByRole = (widget: Gtk.Widget, valueArray: number[]): void => {
    requireSelectableRole(widget, "deselect");

    if (!hasIndexedChildren(widget)) {
        throw usageError(new TypeError("Cannot deselect options: the widget exposes no children to deselect by index"));
    }

    applyIndexedChildren(widget, valueArray, "deselect", unselectChildRow);
};

/** Unselects positions without activating them. */
const deselectOptions = (widget: Gtk.Accessible, values: number | number[]): Promise<void> =>
    runSelectionEvent(requireWidget(widget), values, deselectInListView, deselectByRole);

export { selectOptions, deselectOptions };
