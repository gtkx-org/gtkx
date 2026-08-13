import type { ReactElement, ReactNode, RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { PropertyExpression, StringObject } from "@gtkx/gi/gtk";
import {
    GtkColumnViewColumn,
    GtkCustomSorter,
    GtkDropDown,
    GtkMultiSelection,
    GtkNoSelection,
    GtkSingleSelection,
    GtkStringList,
} from "@gtkx/jsx/gtk";
import { getClassType } from "@gtkx/runtime";
import { render, screen, userEvent } from "@gtkx/testing";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachClickGesture } from "../helpers/click-gesture.js";
import {
    BUTTON_LABEL,
    buttonFactory,
    ITEM_NAMES,
    itemFactory,
    renderColumnView,
    renderGridView,
    renderListView,
} from "../helpers/list-view-render.js";
import {
    CHILD_NAMES,
    EXPANDABLE_ROOT,
    findBoundExpander,
    LEAF_ROOT,
    newTree,
    renderTree,
    resetTree,
    ROOT_NAMES,
} from "../helpers/tree-list-render.js";

type TreeFixture = { tree: Gtk.TreeListModel; expander: Gtk.TreeExpander; selection: Gtk.MultiSelection };

const NAME_TITLE = "Name";
const SIZE_TITLE = "Size";
const PLAIN_TITLE = "Plain";

const countClickGestures = (widget: Gtk.Widget): number => {
    const controllers = widget.observeControllers();
    let count = 0;

    for (let index = 0; index < controllers.getNItems(); index++) {
        if (controllers.getItem(index) instanceof Gtk.GestureClick) {
            count++;
        }
    }

    return count;
};

const widgetAt = (widgets: Gtk.Widget[], index: number): Gtk.Widget => {
    const widget = widgets[index];

    if (widget === undefined) {
        throw new TypeError(`No widget at index ${String(index)}`);
    }

    return widget;
};

const rowAt = async (index: number): Promise<Gtk.Widget> =>
    widgetAt(await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM), index);

const singleSelectionFrom = (view: Gtk.ListView | Gtk.GridView | Gtk.ColumnView | null): Gtk.SingleSelection => {
    const model = view?.getModel();

    if (!(model instanceof Gtk.SingleSelection)) {
        throw new TypeError("The view has no single selection model");
    }

    return model;
};

const singleSelectionElement = (): ReactElement => <GtkSingleSelection model={Gtk.StringList.new(ITEM_NAMES)} />;
const noSelectionElement = (): ReactElement => <GtkNoSelection model={Gtk.StringList.new(ITEM_NAMES)} />;

const renderSelectableList = (): Promise<RefObject<Gtk.ListView | null>> =>
    renderListView({ model: singleSelectionElement() });

const renderNamedColumn = (): Promise<RefObject<Gtk.ColumnView | null>> =>
    renderColumnView(singleSelectionElement(), <GtkColumnViewColumn title="Name" factory={itemFactory()} />);

const cellAt = async (index: number): Promise<Gtk.Widget> =>
    widgetAt(await screen.findAllByRole(Gtk.AccessibleRole.GRID_CELL), index);

const columnElements = (): ReactNode => (
    <>
        <GtkColumnViewColumn title={NAME_TITLE} factory={itemFactory()} sorter={<GtkCustomSorter />} />
        <GtkColumnViewColumn title={SIZE_TITLE} factory={itemFactory()} sorter={<GtkCustomSorter />} />
        <GtkColumnViewColumn title={PLAIN_TITLE} factory={itemFactory()} />
    </>
);

const renderColumns = (onActivate?: () => void): Promise<RefObject<Gtk.ColumnView | null>> =>
    renderColumnView(
        <GtkMultiSelection model={Gtk.StringList.new(ITEM_NAMES)} />,
        columnElements(),
        onActivate === undefined ? {} : { isSingleClickActivating: true, onActivate },
    );

const sorterFrom = (view: Gtk.ColumnView | null): Gtk.ColumnViewSorter => {
    const sorter = view?.getSorter();

    if (!(sorter instanceof Gtk.ColumnViewSorter)) {
        throw new TypeError("The column view has no column sorter");
    }

    return sorter;
};

const columnAt = (view: Gtk.ColumnView | null, index: number): Gtk.ColumnViewColumn => {
    const column = view?.getColumns().getItem(index);

    if (!(column instanceof Gtk.ColumnViewColumn)) {
        throw new TypeError(`No column at index ${String(index)}`);
    }

    return column;
};

const headerFor = (title: string): Gtk.Widget => screen.getByRole(Gtk.AccessibleRole.COLUMN_HEADER, { name: title });

const headerRowFor = (title: string): Gtk.Widget => {
    const row = headerFor(title).getParent();

    if (row === null) {
        throw new TypeError("The column header has no row");
    }

    return row;
};

const expectUnsorted = (ref: RefObject<Gtk.ColumnView | null>): void => {
    expect(sorterFrom(ref.current).getPrimarySortColumn()).toBeNull();
    expect((ref.current?.getModel() as Gtk.MultiSelection).getSelection().getSize()).toBe(0n);
};

const clickHeaders = async (titles: string[]): Promise<RefObject<Gtk.ColumnView | null>> => {
    const ref = await renderColumns();

    for (const title of titles) {
        await userEvent.click(headerFor(title));
    }

    return ref;
};

const renderFixture = async (rootName: string, isExpanderHidden = false): Promise<TreeFixture> => {
    const tree = newTree();
    const ref = await renderTree(<GtkMultiSelection model={tree} />, { isExpanderHidden });
    const selection = ref.current?.getModel();

    if (!(selection instanceof Gtk.MultiSelection)) {
        throw new TypeError("The list view has no multi selection model");
    }

    return { tree, expander: await findBoundExpander(rootName), selection };
};

const expectCollapsed = ({ tree, expander }: TreeFixture): void => {
    expect(expander.getListRow()?.getExpanded()).toBe(false);
    expect(tree.getNItems()).toBe(ROOT_NAMES.length);
};

describe("clicking a list view row", () => {
    it("selects the row the click lands on", async () => {
        const ref = await renderSelectableList();
        await userEvent.click(await rowAt(1));
        const selection = singleSelectionFrom(ref.current);
        expect(selection.getSelected()).toBe(1);
        expect(selection.getSelection().getSize()).toBe(1n);
    });

    it("selects the row when a label inside it is clicked", async () => {
        const ref = await renderSelectableList();
        await userEvent.click(screen.getByText("gamma"));
        expect(singleSelectionFrom(ref.current).getSelected()).toBe(2);
    });

    it("replaces the selection across clicks", async () => {
        const ref = await renderSelectableList();
        await userEvent.click(await rowAt(2));
        await userEvent.click(await rowAt(0));
        const selection = singleSelectionFrom(ref.current);
        expect(selection.getSelected()).toBe(0);
        expect(selection.getSelection().getSize()).toBe(1n);
    });

    it("focuses the row it selects", async () => {
        await renderSelectableList();
        const row = await rowAt(2);
        await userEvent.click(row);
        expect(row.hasFocus()).toBe(true);
    });

    it("leaves the row's own controllers untouched", async () => {
        await renderSelectableList();
        const row = await rowAt(1);
        const before = countClickGestures(row);
        await userEvent.click(row);
        expect(countClickGestures(row)).toBe(before);
    });
});

describe("pointing at a list view row", () => {
    it("fires a click gesture the row itself carries", async () => {
        const ref = await renderSelectableList();
        const row = await rowAt(1);
        const counts = attachClickGesture(row);
        await userEvent.click(row);
        expect(counts).toEqual({ pressed: 1, released: 1 });
        expect(singleSelectionFrom(ref.current).getSelected()).toBe(1);
    });

    it("fires a click gesture the row carries on a pointer press and release", async () => {
        await renderSelectableList();
        const row = await rowAt(1);
        const counts = attachClickGesture(row);
        await userEvent.pointer(row, "down");
        expect(counts).toEqual({ pressed: 1, released: 0 });
        await userEvent.pointer(row, "up");
        expect(counts).toEqual({ pressed: 1, released: 1 });
    });

    it("selects the row through a pointer click token", async () => {
        const ref = await renderListView({ model: <GtkMultiSelection model={Gtk.StringList.new(ITEM_NAMES)} /> });
        await userEvent.pointer(await rowAt(2), "click");
        const selection = ref.current?.getModel() as Gtk.MultiSelection;
        expect(selection.isSelected(2)).toBe(true);
        expect(selection.getSelection().getSize()).toBe(1n);
    });
});

describe("activating a list view row", () => {
    it("does not activate the row when the view does not activate on a single click", async () => {
        const onActivate = vi.fn();
        await renderListView({ model: noSelectionElement(), onActivate });
        await userEvent.click(await rowAt(1));
        expect(onActivate).not.toHaveBeenCalled();
    });

    it("activates and selects the row when the view activates on a single click", async () => {
        const onActivate = vi.fn();

        const ref = await renderListView({
            model: singleSelectionElement(),
            isSingleClickActivating: true,
            onActivate,
        });

        await userEvent.click(await rowAt(1));
        expect(onActivate).toHaveBeenCalledTimes(1);
        expect(singleSelectionFrom(ref.current).getSelected()).toBe(1);
    });

    it("activates the row once on a double click", async () => {
        const onActivate = vi.fn();
        await renderListView({ model: singleSelectionElement(), onActivate });
        await userEvent.dblClick(await rowAt(1));
        expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it("activates the row once per press when the view activates on a single click", async () => {
        const onActivate = vi.fn();

        await renderListView({
            model: singleSelectionElement(),
            isSingleClickActivating: true,
            onActivate,
        });

        await userEvent.tripleClick(await rowAt(1));
        expect(onActivate).toHaveBeenCalledTimes(3);
    });
});

describe("clicking a button inside a list view row", () => {
    it("activates the button without selecting the row", async () => {
        const onClicked = vi.fn();
        await renderListView({ model: noSelectionElement(), factory: buttonFactory(onClicked) });
        const buttons = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON, { name: BUTTON_LABEL });
        await userEvent.click(widgetAt(buttons, 0));
        expect(onClicked).toHaveBeenCalledTimes(1);
    });
});

describe("clicking a grid view cell", () => {
    it("selects the item behind the cell", async () => {
        const ref = await renderGridView(singleSelectionElement());
        const cells = await screen.findAllByRole(Gtk.AccessibleRole.GRID_CELL);
        await userEvent.click(widgetAt(cells, 1));
        expect(singleSelectionFrom(ref.current).getSelected()).toBe(1);
    });
});

describe("clicking a column view cell", () => {
    it("selects the row the cell belongs to", async () => {
        const ref = await renderNamedColumn();
        await userEvent.click(screen.getByText("gamma"));
        const selection = singleSelectionFrom(ref.current);
        expect(selection.getSelected()).toBe(2);
        expect(selection.getSelection().getSize()).toBe(1n);
    });

    it("selects the row when the cell itself is clicked", async () => {
        const ref = await renderNamedColumn();
        await userEvent.click(await cellAt(1));
        const selection = singleSelectionFrom(ref.current);
        expect(selection.getSelected()).toBe(1);
        expect(selection.getSelection().getSize()).toBe(1n);
    });

    it("selects the row when the cell takes a pointer click token", async () => {
        const ref = await renderNamedColumn();
        await userEvent.pointer(await cellAt(2), "click");
        expect(singleSelectionFrom(ref.current).getSelected()).toBe(2);
    });
});

describe("clicking a column view header", () => {
    it("sorts by the clicked column, ascending", async () => {
        const ref = await clickHeaders([NAME_TITLE]);
        const sorter = sorterFrom(ref.current);
        expect(sorter.getPrimarySortColumn()).toBe(columnAt(ref.current, 0));
        expect(sorter.getPrimarySortOrder()).toBe(Gtk.SortType.ASCENDING);
    });

    it("inverts the order on a second click", async () => {
        const ref = await clickHeaders([NAME_TITLE, NAME_TITLE]);
        const sorter = sorterFrom(ref.current);
        expect(sorter.getPrimarySortColumn()).toBe(columnAt(ref.current, 0));
        expect(sorter.getPrimarySortOrder()).toBe(Gtk.SortType.DESCENDING);
    });

    it("moves the primary column when a different header is clicked", async () => {
        const ref = await clickHeaders([NAME_TITLE, SIZE_TITLE]);
        const sorter = sorterFrom(ref.current);
        expect(sorter.getPrimarySortColumn()).toBe(columnAt(ref.current, 1));
        expect(sorter.getPrimarySortOrder()).toBe(Gtk.SortType.ASCENDING);
    });

    it("sorts when the label inside the header is clicked", async () => {
        const ref = await renderColumns();
        await userEvent.click(screen.getByText(SIZE_TITLE));
        expect(sorterFrom(ref.current).getPrimarySortColumn()).toBe(columnAt(ref.current, 1));
    });

    it("inverts the order once per press on a double click", async () => {
        const ref = await renderColumns();
        await userEvent.dblClick(headerFor(NAME_TITLE));
        expect(sorterFrom(ref.current).getPrimarySortOrder()).toBe(Gtk.SortType.DESCENDING);
    });

    it("leaves the sorter alone for a column with no sorter", async () => {
        expectUnsorted(await clickHeaders([PLAIN_TITLE]));
    });

    it("fires a click gesture the header itself carries", async () => {
        const ref = await renderColumns();
        const header = headerFor(NAME_TITLE);
        const counts = attachClickGesture(header);
        await userEvent.click(header);
        expect(counts).toEqual({ pressed: 1, released: 1 });
        expect(sorterFrom(ref.current).getPrimarySortColumn()).toBe(columnAt(ref.current, 0));
    });
});

describe("clicking the row that carries the column headers", () => {
    it("leaves the sorter and the selection alone", async () => {
        const ref = await renderColumns();
        await userEvent.click(headerRowFor(NAME_TITLE));
        expectUnsorted(ref);
    });

    it("does not activate the view that activates on a single click", async () => {
        const onActivate = vi.fn();
        await renderColumns(onActivate);
        await userEvent.click(headerRowFor(NAME_TITLE));
        expect(onActivate).not.toHaveBeenCalled();
    });

    it("leaves the sorter alone when it takes a pointer click token", async () => {
        const ref = await renderColumns();
        await userEvent.pointer(headerRowFor(NAME_TITLE), "click");
        expectUnsorted(ref);
    });
});

beforeEach(resetTree);

describe("clicking a tree expander (1)", () => {
    it("expands the row behind it and leaves the enclosing row unselected", async () => {
        const { tree, expander, selection } = await renderFixture(EXPANDABLE_ROOT);
        await userEvent.click(expander);
        expect(expander.getListRow()?.getExpanded()).toBe(true);
        expect(tree.getNItems()).toBe(ROOT_NAMES.length + CHILD_NAMES.length);
        expect(selection.getSelection().getSize()).toBe(0n);
    });

    it("collapses the row again on a second click", async () => {
        const fixture = await renderFixture(EXPANDABLE_ROOT);
        await userEvent.click(fixture.expander);
        await userEvent.click(fixture.expander);
        expectCollapsed(fixture);
    });

    it("toggles twice on a double click, ending collapsed", async () => {
        const fixture = await renderFixture(EXPANDABLE_ROOT);
        await userEvent.dblClick(fixture.expander);
        expectCollapsed(fixture);
    });

    it.each([
        ["a click", (expander: Gtk.TreeExpander): Promise<void> => userEvent.click(expander)],
        ["a pointer click token", (expander: Gtk.TreeExpander): Promise<void> => userEvent.pointer(expander, "click")],
    ])("fires a click gesture the expander itself carries on %s", async (_name, deliver) => {
        const fixture = await renderFixture(EXPANDABLE_ROOT);
        const counts = attachClickGesture(fixture.expander);
        await deliver(fixture.expander);
        expect(counts).toEqual({ pressed: 1, released: 1 });
        expect(fixture.expander.getListRow()?.getExpanded()).toBe(true);
    });

    it("selects the enclosing row instead when the expander's child label is clicked", async () => {
        const { expander, selection } = await renderFixture(EXPANDABLE_ROOT);
        await userEvent.click(screen.getByText(EXPANDABLE_ROOT));
        expect(expander.getListRow()?.getExpanded()).toBe(false);
        expect(selection.isSelected(0)).toBe(true);
    });

    it("selects the enclosing row when the expander has no children", async () => {
        const fixture = await renderFixture(LEAF_ROOT);
        await userEvent.click(fixture.expander);
        expectCollapsed(fixture);
        expect(fixture.selection.isSelected(1)).toBe(true);
    });
});

describe("clicking a tree expander (2)", () => {
    it("selects the enclosing row when the expander is hidden", async () => {
        const fixture = await renderFixture(EXPANDABLE_ROOT, true);
        await userEvent.click(fixture.expander);
        expectCollapsed(fixture);
        expect(fixture.selection.isSelected(0)).toBe(true);
    });
});

describe("GtkDropDown - expression prop", () => {
    it("takes a Gtk.Expression as an initial prop", async () => {
        const ref = createRef<Gtk.DropDown>();
        const expression = PropertyExpression.new(getClassType(StringObject), null, "string");

        await render(
            <GtkDropDown ref={ref} expression={expression} model={<GtkStringList strings={["a", "b"]} />} />,
        );

        expect(ref.current?.getExpression()).not.toBeNull();
    });
});
