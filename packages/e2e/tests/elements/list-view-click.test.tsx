import type { ReactElement, RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnViewColumn, GtkMultiSelection, GtkNoSelection, GtkSingleSelection } from "@gtkx/jsx/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
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
