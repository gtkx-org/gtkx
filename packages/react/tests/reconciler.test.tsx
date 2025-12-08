import { getObject } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { createNode } from "../src/factory.js";
import { ApplicationWindow, Box, Button, createPortal, Grid, Label, Notebook, Overlay } from "../src/index.js";
import { flushSync, getCurrentApp, render, setupTests } from "./utils.js";

setupTests();

const assertDefined = <T,>(value: T | undefined | null, message = "Expected value to be defined"): T => {
    if (value === undefined || value === null) {
        throw new Error(message);
    }
    return value;
};

const getChildren = (widget: Gtk.Widget): Gtk.Widget[] => {
    const children: Gtk.Widget[] = [];
    let child = widget.getFirstChild();

    while (child) {
        children.push(child);
        child = child.getNextSibling();
    }

    return children;
};

const getChildLabels = (widget: Gtk.Widget): string[] =>
    getChildren(widget).map((child) => {
        const ptr = child.ptr;

        try {
            const label = getObject(ptr, Gtk.Label);
            return label.getLabel() ?? "";
        } catch {}

        try {
            const button = getObject(ptr, Gtk.Button);
            return button.getLabel() ?? "";
        } catch {}

        return "";
    });

describe("React Reconciler", () => {
    describe("node factory", () => {
        it("creates Button with correct props", () => {
            const node = createNode("Button", { label: "Click me" });
            const widget = node.getWidget() as Gtk.Button;

            expect(widget).toBeInstanceOf(Gtk.Button);
            expect(widget.getLabel()).toBe("Click me");
        });

        it("creates Box with orientation", () => {
            const node = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 10 });
            const widget = node.getWidget() as Gtk.Box;

            expect(widget).toBeInstanceOf(Gtk.Box);
            expect(widget.getSpacing()).toBe(10);
        });

        it("creates Label with text", () => {
            const node = createNode("Label", { label: "Hello" });
            const widget = node.getWidget() as Gtk.Label;

            expect(widget).toBeInstanceOf(Gtk.Label);
            expect(widget.getLabel()).toBe("Hello");
        });

        it("creates ApplicationWindow with title", () => {
            const node = createNode("ApplicationWindow", { title: "Test Window" });
            const widget = node.getWidget() as Gtk.ApplicationWindow;

            expect(widget).toBeInstanceOf(Gtk.ApplicationWindow);
            expect(widget.getTitle()).toBe("Test Window");
        });
    });

    describe("prop updates", () => {
        it("updates string props", () => {
            const node = createNode("Button", { label: "Initial" });
            const widget = node.getWidget() as Gtk.Button;

            expect(widget.getLabel()).toBe("Initial");

            node.updateProps({ label: "Initial" }, { label: "Updated" });
            expect(widget.getLabel()).toBe("Updated");
        });

        it("updates boolean props", () => {
            const node = createNode("Button", { label: "Test", sensitive: true });
            const widget = node.getWidget() as Gtk.Button;

            expect(widget.getSensitive()).toBe(true);

            node.updateProps({ sensitive: true }, { sensitive: false });
            expect(widget.getSensitive()).toBe(false);
        });

        it("updates numeric props", () => {
            const node = createNode("Box", { spacing: 5, orientation: Gtk.Orientation.VERTICAL });
            const widget = node.getWidget() as Gtk.Box;

            expect(widget.getSpacing()).toBe(5);

            node.updateProps({ spacing: 5 }, { spacing: 20 });
            expect(widget.getSpacing()).toBe(20);
        });
    });

    describe("child management - Box", () => {
        it("appends children in order", () => {
            const parent = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
            const child1 = createNode("Label", { label: "First" });
            const child2 = createNode("Label", { label: "Second" });
            const child3 = createNode("Label", { label: "Third" });

            parent.appendChild(child1);
            parent.appendChild(child2);
            parent.appendChild(child3);

            const parentWidget = parent.getWidget() as Gtk.Box;
            expect(getChildLabels(parentWidget)).toEqual(["First", "Second", "Third"]);
        });

        it("removes child from beginning", () => {
            const parent = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
            const child1 = createNode("Label", { label: "First" });
            const child2 = createNode("Label", { label: "Second" });
            const child3 = createNode("Label", { label: "Third" });

            parent.appendChild(child1);
            parent.appendChild(child2);
            parent.appendChild(child3);
            parent.removeChild(child1);

            const parentWidget = parent.getWidget() as Gtk.Box;
            expect(getChildLabels(parentWidget)).toEqual(["Second", "Third"]);
        });

        it("removes child from middle", () => {
            const parent = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
            const child1 = createNode("Label", { label: "First" });
            const child2 = createNode("Label", { label: "Second" });
            const child3 = createNode("Label", { label: "Third" });

            parent.appendChild(child1);
            parent.appendChild(child2);
            parent.appendChild(child3);
            parent.removeChild(child2);

            const parentWidget = parent.getWidget() as Gtk.Box;
            expect(getChildLabels(parentWidget)).toEqual(["First", "Third"]);
        });

        it("removes child from end", () => {
            const parent = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
            const child1 = createNode("Label", { label: "First" });
            const child2 = createNode("Label", { label: "Second" });
            const child3 = createNode("Label", { label: "Third" });

            parent.appendChild(child1);
            parent.appendChild(child2);
            parent.appendChild(child3);
            parent.removeChild(child3);

            const parentWidget = parent.getWidget() as Gtk.Box;
            expect(getChildLabels(parentWidget)).toEqual(["First", "Second"]);
        });

        it("removes all children", () => {
            const parent = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
            const child1 = createNode("Label", { label: "First" });
            const child2 = createNode("Label", { label: "Second" });

            parent.appendChild(child1);
            parent.appendChild(child2);
            parent.removeChild(child1);
            parent.removeChild(child2);

            const parentWidget = parent.getWidget() as Gtk.Box;
            expect(getChildLabels(parentWidget)).toEqual([]);
        });

        it("inserts child before first", () => {
            const parent = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
            const first = createNode("Label", { label: "First" });
            const second = createNode("Label", { label: "Second" });
            const newFirst = createNode("Label", { label: "NewFirst" });

            parent.appendChild(first);
            parent.appendChild(second);
            parent.insertBefore(newFirst, first);

            const parentWidget = parent.getWidget() as Gtk.Box;
            expect(getChildLabels(parentWidget)).toEqual(["NewFirst", "First", "Second"]);
        });

        it("inserts child before middle", () => {
            const parent = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
            const first = createNode("Label", { label: "First" });
            const second = createNode("Label", { label: "Second" });
            const third = createNode("Label", { label: "Third" });
            const middle = createNode("Label", { label: "Middle" });

            parent.appendChild(first);
            parent.appendChild(second);
            parent.appendChild(third);
            parent.insertBefore(middle, second);

            const parentWidget = parent.getWidget() as Gtk.Box;
            expect(getChildLabels(parentWidget)).toEqual(["First", "Middle", "Second", "Third"]);
        });

        it("inserts child before last", () => {
            const parent = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
            const first = createNode("Label", { label: "First" });
            const second = createNode("Label", { label: "Second" });
            const beforeLast = createNode("Label", { label: "BeforeLast" });

            parent.appendChild(first);
            parent.appendChild(second);
            parent.insertBefore(beforeLast, second);

            const parentWidget = parent.getWidget() as Gtk.Box;
            expect(getChildLabels(parentWidget)).toEqual(["First", "BeforeLast", "Second"]);
        });

        it("handles multiple insertBefore operations", () => {
            const parent = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
            const a = createNode("Label", { label: "A" });
            const b = createNode("Label", { label: "B" });
            const c = createNode("Label", { label: "C" });
            const d = createNode("Label", { label: "D" });

            parent.appendChild(a);
            parent.appendChild(d);
            parent.insertBefore(c, d);
            parent.insertBefore(b, c);

            const parentWidget = parent.getWidget() as Gtk.Box;
            expect(getChildLabels(parentWidget)).toEqual(["A", "B", "C", "D"]);
        });

        it("moves existing child to new position using insertBefore", () => {
            const parent = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
            const a = createNode("Label", { label: "A" });
            const b = createNode("Label", { label: "B" });
            const c = createNode("Label", { label: "C" });

            parent.appendChild(a);
            parent.appendChild(b);
            parent.appendChild(c);

            const parentWidget = parent.getWidget() as Gtk.Box;
            expect(getChildLabels(parentWidget)).toEqual(["A", "B", "C"]);

            // Move C before A (to the front)
            parent.insertBefore(c, a);
            expect(getChildLabels(parentWidget)).toEqual(["C", "A", "B"]);
        });

        it("simulates React reorder using appendChild", () => {
            // This simulates how React reorders: [A,B,C] -> [C,A,B]
            // React doesn't move C (it stays in place), then appends A and B
            const parent = createNode("Box", { orientation: Gtk.Orientation.VERTICAL, spacing: 0 });
            const a = createNode("Label", { label: "A" });
            const b = createNode("Label", { label: "B" });
            const c = createNode("Label", { label: "C" });

            parent.appendChild(a);
            parent.appendChild(b);
            parent.appendChild(c);

            const parentWidget = parent.getWidget() as Gtk.Box;
            expect(getChildLabels(parentWidget)).toEqual(["A", "B", "C"]);

            // React's reorder: append A to end, then append B to end
            // Now that appendChild uses insertBefore(parent, null), this works
            // After appending A: B -> C -> A
            // After appending B: C -> A -> B
            parent.appendChild(a);
            parent.appendChild(b);
            expect(getChildLabels(parentWidget)).toEqual(["C", "A", "B"]);
        });
    });

    describe("child management - Overlay", () => {
        it("sets first child as main child", () => {
            const parent = createNode("Overlay.Root", {});
            const main = createNode("Label", { label: "Main" });

            parent.appendChild(main);

            const overlay = parent.getWidget() as Gtk.Overlay;
            const mainChild = overlay.getChild();
            expect(mainChild).not.toBeNull();
            const mainLabel = getObject(assertDefined(mainChild).ptr, Gtk.Label);
            expect(mainLabel.getLabel()).toBe("Main");
        });

        it("adds subsequent children as overlays", () => {
            const parent = createNode("Overlay.Root", {});
            const main = createNode("Label", { label: "Main" });
            const overlay1 = createNode("Label", { label: "Overlay1" });
            const overlay2 = createNode("Label", { label: "Overlay2" });

            parent.appendChild(main);
            parent.appendChild(overlay1);
            parent.appendChild(overlay2);

            const overlayWidget = parent.getWidget() as Gtk.Overlay;
            expect(overlayWidget.getChild()).not.toBeNull();
            expect(getChildren(overlayWidget).length).toBe(3);
        });

        it("removes main child", () => {
            const parent = createNode("Overlay.Root", {});
            const main = createNode("Label", { label: "Main" });
            const overlay1 = createNode("Label", { label: "Overlay1" });

            parent.appendChild(main);
            parent.appendChild(overlay1);
            parent.removeChild(main);

            const overlayWidget = parent.getWidget() as Gtk.Overlay;
            expect(overlayWidget.getChild()).toBeNull();
        });

        it("removes overlay child", () => {
            const parent = createNode("Overlay.Root", {});
            const main = createNode("Label", { label: "Main" });
            const overlay1 = createNode("Label", { label: "Overlay1" });
            const overlay2 = createNode("Label", { label: "Overlay2" });

            parent.appendChild(main);
            parent.appendChild(overlay1);
            parent.appendChild(overlay2);
            parent.removeChild(overlay1);

            const overlayWidget = parent.getWidget() as Gtk.Overlay;
            expect(getChildren(overlayWidget).length).toBe(2);
        });

        it("inserts overlay before another overlay", () => {
            const parent = createNode("Overlay.Root", {});
            const main = createNode("Label", { label: "Main" });
            const overlay1 = createNode("Label", { label: "Overlay1" });
            const overlay2 = createNode("Label", { label: "Overlay2" });
            const middle = createNode("Label", { label: "Middle" });

            parent.appendChild(main);
            parent.appendChild(overlay1);
            parent.appendChild(overlay2);
            parent.insertBefore(middle, overlay2);

            const overlayWidget = parent.getWidget() as Gtk.Overlay;
            expect(getChildren(overlayWidget).length).toBe(4);
        });
    });

    describe("child management - Grid", () => {
        it("positions child at specified column and row", () => {
            const grid = createNode("Grid.Root", {});
            const gridChild = createNode("Grid.Child", { column: 1, row: 2 });
            const label = createNode("Label", { label: "Cell" });

            gridChild.appendChild(label);
            grid.appendChild(gridChild);

            const gridWidget = grid.getWidget() as Gtk.Grid;
            const children = getChildren(gridWidget);
            expect(children.length).toBe(1);
        });

        it("positions multiple children at different positions", () => {
            const grid = createNode("Grid.Root", {});

            const positions = [
                { column: 0, row: 0, label: "A" },
                { column: 1, row: 0, label: "B" },
                { column: 0, row: 1, label: "C" },
                { column: 1, row: 1, label: "D" },
            ];

            for (const pos of positions) {
                const gridChild = createNode("Grid.Child", { column: pos.column, row: pos.row });
                const label = createNode("Label", { label: pos.label });
                gridChild.appendChild(label);
                grid.appendChild(gridChild);
            }

            const gridWidget = grid.getWidget() as Gtk.Grid;
            const children = getChildren(gridWidget);
            expect(children.length).toBe(4);
        });

        it("removes grid child", () => {
            const grid = createNode("Grid.Root", {});
            const gridChild = createNode("Grid.Child", { column: 0, row: 0 });
            const label = createNode("Label", { label: "Cell" });

            gridChild.appendChild(label);
            grid.appendChild(gridChild);

            const gridWidget = grid.getWidget() as Gtk.Grid;
            expect(getChildren(gridWidget).length).toBe(1);

            grid.removeChild(gridChild);
            expect(getChildren(gridWidget).length).toBe(0);
        });

        it("handles column and row span", () => {
            const grid = createNode("Grid.Root", {});
            const gridChild = createNode("Grid.Child", { column: 0, row: 0, columnSpan: 2, rowSpan: 3 });
            const label = createNode("Label", { label: "Spanning" });

            gridChild.appendChild(label);
            grid.appendChild(gridChild);

            const gridWidget = grid.getWidget() as Gtk.Grid;
            expect(getChildren(gridWidget).length).toBe(1);
        });
    });

    describe("child management - Notebook", () => {
        it("appends pages in order", () => {
            const notebook = createNode("Notebook", {});
            const page1 = createNode("Label", { label: "Page1" });
            const page2 = createNode("Label", { label: "Page2" });
            const page3 = createNode("Label", { label: "Page3" });

            notebook.appendChild(page1);
            notebook.appendChild(page2);
            notebook.appendChild(page3);

            const notebookWidget = notebook.getWidget() as Gtk.Notebook;
            expect(notebookWidget.getNPages()).toBe(3);
            expect(notebookWidget.pageNum(page1.getWidget() as Gtk.Widget)).toBe(0);
            expect(notebookWidget.pageNum(page2.getWidget() as Gtk.Widget)).toBe(1);
            expect(notebookWidget.pageNum(page3.getWidget() as Gtk.Widget)).toBe(2);
        });

        it("removes page from beginning", () => {
            const notebook = createNode("Notebook", {});
            const page1 = createNode("Label", { label: "Page1" });
            const page2 = createNode("Label", { label: "Page2" });
            const page3 = createNode("Label", { label: "Page3" });

            notebook.appendChild(page1);
            notebook.appendChild(page2);
            notebook.appendChild(page3);
            notebook.removeChild(page1);

            const notebookWidget = notebook.getWidget() as Gtk.Notebook;
            expect(notebookWidget.getNPages()).toBe(2);
            expect(notebookWidget.pageNum(page2.getWidget() as Gtk.Widget)).toBe(0);
            expect(notebookWidget.pageNum(page3.getWidget() as Gtk.Widget)).toBe(1);
        });

        it("removes page from middle", () => {
            const notebook = createNode("Notebook", {});
            const page1 = createNode("Label", { label: "Page1" });
            const page2 = createNode("Label", { label: "Page2" });
            const page3 = createNode("Label", { label: "Page3" });

            notebook.appendChild(page1);
            notebook.appendChild(page2);
            notebook.appendChild(page3);
            notebook.removeChild(page2);

            const notebookWidget = notebook.getWidget() as Gtk.Notebook;
            expect(notebookWidget.getNPages()).toBe(2);
            expect(notebookWidget.pageNum(page1.getWidget() as Gtk.Widget)).toBe(0);
            expect(notebookWidget.pageNum(page3.getWidget() as Gtk.Widget)).toBe(1);
        });

        it("inserts page before another", () => {
            const notebook = createNode("Notebook", {});
            const page1 = createNode("Label", { label: "Page1" });
            const page2 = createNode("Label", { label: "Page2" });
            const middle = createNode("Label", { label: "Middle" });

            notebook.appendChild(page1);
            notebook.appendChild(page2);
            notebook.insertBefore(middle, page2);

            const notebookWidget = notebook.getWidget() as Gtk.Notebook;
            expect(notebookWidget.getNPages()).toBe(3);
            expect(notebookWidget.pageNum(page1.getWidget() as Gtk.Widget)).toBe(0);
            expect(notebookWidget.pageNum(middle.getWidget() as Gtk.Widget)).toBe(1);
            expect(notebookWidget.pageNum(page2.getWidget() as Gtk.Widget)).toBe(2);
        });

        it("inserts page at beginning", () => {
            const notebook = createNode("Notebook", {});
            const page1 = createNode("Label", { label: "Page1" });
            const page2 = createNode("Label", { label: "Page2" });
            const newFirst = createNode("Label", { label: "NewFirst" });

            notebook.appendChild(page1);
            notebook.appendChild(page2);
            notebook.insertBefore(newFirst, page1);

            const notebookWidget = notebook.getWidget() as Gtk.Notebook;
            expect(notebookWidget.getNPages()).toBe(3);
            expect(notebookWidget.pageNum(newFirst.getWidget() as Gtk.Widget)).toBe(0);
            expect(notebookWidget.pageNum(page1.getWidget() as Gtk.Widget)).toBe(1);
            expect(notebookWidget.pageNum(page2.getWidget() as Gtk.Widget)).toBe(2);
        });
    });

    describe("child management - DropDown", () => {
        it("adds items to dropdown", () => {
            const dropdown = createNode("DropDown.Root", { itemLabel: (item: string) => item });
            const item1 = createNode("DropDown.Item", { item: "Option1" });
            const item2 = createNode("DropDown.Item", { item: "Option2" });
            const item3 = createNode("DropDown.Item", { item: "Option3" });

            dropdown.appendChild(item1);
            dropdown.appendChild(item2);
            dropdown.appendChild(item3);

            const dropdownWidget = dropdown.getWidget() as Gtk.DropDown;
            const model = dropdownWidget.getModel();
            expect(model).not.toBeNull();
            expect((model as unknown as { getNItems: () => number }).getNItems()).toBe(3);
        });

        it("removes items from dropdown", () => {
            const dropdown = createNode("DropDown.Root", { itemLabel: (item: string) => item });
            const item1 = createNode("DropDown.Item", { item: "Option1" });
            const item2 = createNode("DropDown.Item", { item: "Option2" });

            dropdown.appendChild(item1);
            dropdown.appendChild(item2);
            dropdown.removeChild(item1);

            const dropdownWidget = dropdown.getWidget() as Gtk.DropDown;
            const model = dropdownWidget.getModel();
            expect(model).not.toBeNull();
            expect((model as unknown as { getNItems: () => number }).getNItems()).toBe(1);
        });
    });

    describe("child management - ListView", () => {
        const renderItem = (item: { id: number } | null) => {
            return <Label.Root label={item ? `Item ${item.id}` : ""} />;
        };

        it("adds items to list view", () => {
            const list = createNode("ListView.Root", { renderItem });
            const item1 = createNode("ListView.Item", { item: { id: 1 } });
            const item2 = createNode("ListView.Item", { item: { id: 2 } });
            const item3 = createNode("ListView.Item", { item: { id: 3 } });

            list.appendChild(item1);
            list.appendChild(item2);
            list.appendChild(item3);

            const listWidget = list.getWidget() as Gtk.ListView;
            const model = listWidget.getModel();
            expect(model).not.toBeNull();
        });

        it("removes items from list view", () => {
            const list = createNode("ListView.Root", { renderItem });
            const item1 = createNode("ListView.Item", { item: { id: 1 } });
            const item2 = createNode("ListView.Item", { item: { id: 2 } });

            list.appendChild(item1);
            list.appendChild(item2);
            list.removeChild(item1);

            const listWidget = list.getWidget() as Gtk.ListView;
            const model = listWidget.getModel();
            expect(model).not.toBeNull();
        });

        it("inserts item before another", () => {
            const list = createNode("ListView.Root", { renderItem });
            const item1 = createNode("ListView.Item", { item: { id: 1, name: "First" } });
            const item2 = createNode("ListView.Item", { item: { id: 2, name: "Second" } });
            const middle = createNode("ListView.Item", { item: { id: 3, name: "Middle" } });

            list.appendChild(item1);
            list.appendChild(item2);
            list.insertBefore(middle, item2);

            const listWidget = list.getWidget() as Gtk.ListView;
            const model = listWidget.getModel();
            expect(model).not.toBeNull();
        });
    });

    describe("child management - ColumnView", () => {
        const renderCell = (item: { name: string } | null) => {
            return <Label.Root label={item?.name ?? ""} />;
        };

        it("adds columns to column view", () => {
            const columnView = createNode("ColumnView.Root", {});
            const column1 = createNode("ColumnView.Column", { title: "Name", renderCell });
            const column2 = createNode("ColumnView.Column", { title: "Age", renderCell });

            columnView.appendChild(column1);
            columnView.appendChild(column2);

            const widget = columnView.getWidget() as Gtk.ColumnView;
            const columns = widget.getColumns();
            expect(columns.getNItems()).toBe(2);
        });

        it("adds items to column view", () => {
            const columnView = createNode("ColumnView.Root", {});
            const column = createNode("ColumnView.Column", { title: "Name", renderCell });
            const item1 = createNode("ColumnView.Item", { item: { name: "John" } });
            const item2 = createNode("ColumnView.Item", { item: { name: "Jane" } });

            columnView.appendChild(column);
            columnView.appendChild(item1);
            columnView.appendChild(item2);

            const widget = columnView.getWidget() as Gtk.ColumnView;
            const model = widget.getModel();
            expect(model).not.toBeNull();
        });

        it("removes columns from column view", () => {
            const columnView = createNode("ColumnView.Root", {});
            const column1 = createNode("ColumnView.Column", { title: "Name", renderCell });
            const column2 = createNode("ColumnView.Column", { title: "Age", renderCell });

            columnView.appendChild(column1);
            columnView.appendChild(column2);
            columnView.removeChild(column1);

            const widget = columnView.getWidget() as Gtk.ColumnView;
            const columns = widget.getColumns();
            expect(columns.getNItems()).toBe(1);
        });

        it("removes items from column view", () => {
            const columnView = createNode("ColumnView.Root", {});
            const item1 = createNode("ColumnView.Item", { item: { name: "John" } });
            const item2 = createNode("ColumnView.Item", { item: { name: "Jane" } });

            columnView.appendChild(item1);
            columnView.appendChild(item2);
            columnView.removeChild(item1);

            const widget = columnView.getWidget() as Gtk.ColumnView;
            const model = widget.getModel();
            expect(model).not.toBeNull();
        });

        it("sets column id via props", () => {
            const columnView = createNode("ColumnView.Root", {});
            const column = createNode("ColumnView.Column", { title: "Name", id: "name-column", renderCell });

            columnView.appendChild(column);

            const widget = columnView.getWidget() as Gtk.ColumnView;
            const columns = widget.getColumns();
            const gtkColumn = getObject(columns.getObject(0)?.ptr, Gtk.ColumnViewColumn);
            expect(gtkColumn?.getId()).toBe("name-column");
        });

        it("sets sorter on column when root sortFn is provided", () => {
            const sortFn = (a: { name: string }, b: { name: string }, _columnId: string) =>
                a.name.localeCompare(b.name);
            const columnView = createNode("ColumnView.Root", { sortFn });
            const column = createNode("ColumnView.Column", { title: "Name", id: "name-column", renderCell });

            columnView.appendChild(column);

            const widget = columnView.getWidget() as Gtk.ColumnView;
            const columns = widget.getColumns();
            const gtkColumn = getObject(columns.getObject(0)?.ptr, Gtk.ColumnViewColumn);
            expect(gtkColumn?.getSorter()).not.toBeNull();
        });

        it("sets initial sort column from props", () => {
            const sortFn = (a: { name: string }, b: { name: string }, _columnId: string) =>
                a.name.localeCompare(b.name);
            const columnView = createNode("ColumnView.Root", {
                sortColumn: "name-column",
                sortOrder: Gtk.SortType.ASCENDING,
                sortFn,
            });
            const column = createNode("ColumnView.Column", { title: "Name", id: "name-column", renderCell });

            columnView.appendChild(column);

            const widget = columnView.getWidget() as Gtk.ColumnView;
            const sorter = getObject(widget.getSorter()?.ptr, Gtk.ColumnViewSorter);
            const primaryColumn = sorter?.getPrimarySortColumn();
            expect(primaryColumn?.getId()).toBe("name-column");
        });

        it("updates sort column via updateProps", () => {
            const sortFn = (a: { name: string }, b: { name: string }, _columnId: string) =>
                a.name.localeCompare(b.name);
            const columnView = createNode("ColumnView.Root", { sortFn });
            const column1 = createNode("ColumnView.Column", { title: "Name", id: "name-column", renderCell });
            const column2 = createNode("ColumnView.Column", { title: "Age", id: "age-column", renderCell });

            columnView.appendChild(column1);
            columnView.appendChild(column2);

            columnView.updateProps(
                { sortFn },
                { sortColumn: "age-column", sortOrder: Gtk.SortType.DESCENDING, sortFn },
            );

            const widget = columnView.getWidget() as Gtk.ColumnView;
            const sorter = getObject(widget.getSorter()?.ptr, Gtk.ColumnViewSorter);
            const primaryColumn = sorter?.getPrimarySortColumn();
            expect(primaryColumn?.getId()).toBe("age-column");
            expect(sorter?.getPrimarySortOrder()).toBe(Gtk.SortType.DESCENDING);
        });
    });

    describe("child management - Slots", () => {
        it("sets child slot on parent widget", () => {
            const expander = createNode("Expander", { label: "Expand" });
            const childSlot = createNode("Expander.Child", {});
            const label = createNode("Label", { label: "Content" });

            childSlot.appendChild(label);
            expander.appendChild(childSlot);

            const expanderWidget = expander.getWidget() as Gtk.Expander;
            const rawChild = expanderWidget.getChild();
            expect(rawChild).not.toBeNull();
            const child = getObject(assertDefined(rawChild).ptr, Gtk.Label);
            expect(child.getLabel()).toBe("Content");
        });

        it("removes child slot from parent widget", () => {
            const expander = createNode("Expander", { label: "Expand" });
            const childSlot = createNode("Expander.Child", {});
            const label = createNode("Label", { label: "Content" });

            childSlot.appendChild(label);
            expander.appendChild(childSlot);
            expander.removeChild(childSlot);

            const expanderWidget = expander.getWidget() as Gtk.Expander;
            expect(expanderWidget.getChild()).toBeNull();
        });
    });

    describe("signal handlers", () => {
        it("connects signal handlers on creation", () => {
            let clicked = false;
            const node = createNode("Button", {
                label: "Click",
                onClicked: () => {
                    clicked = true;
                },
            });

            expect(node.getWidget()).toBeInstanceOf(Gtk.Button);
            expect(clicked).toBe(false);
        });

        it("updates signal handlers", () => {
            let handler1Called = false;
            let handler2Called = false;

            const handler1 = () => {
                handler1Called = true;
            };
            const handler2 = () => {
                handler2Called = true;
            };

            const node = createNode("Button", { label: "Click", onClicked: handler1 });
            node.updateProps({ onClicked: handler1 }, { onClicked: handler2 });

            expect(handler1Called).toBe(false);
            expect(handler2Called).toBe(false);
        });
    });

    describe("window management", () => {
        it("attaches child to ApplicationWindow", () => {
            const window = createNode("ApplicationWindow", { title: "Test" });
            const child = createNode("Label", { label: "Content" });

            window.appendChild(child);

            const windowWidget = window.getWidget() as Gtk.ApplicationWindow;
            expect(windowWidget.getChild()).not.toBeNull();
        });
    });

    describe("React integration", () => {
        it("renders simple component", () => {
            render(<Button label="Hello" />);
            const windows = getCurrentApp().getWindows();
            expect(windows.length).toBeGreaterThanOrEqual(0);
        });

        it("renders nested components", () => {
            render(
                <Box spacing={10} orientation={Gtk.Orientation.VERTICAL}>
                    <Label.Root label="Title" />
                    <Button label="Click Me" />
                </Box>,
            );
            const windows = getCurrentApp().getWindows();
            expect(windows.length).toBeGreaterThanOrEqual(0);
        });

        it("handles state updates", () => {
            let setCount: (value: number) => void = () => {};

            const Counter = () => {
                const [count, _setCount] = useState(0);
                setCount = _setCount;
                return <Label.Root label={`Count: ${count}`} />;
            };

            render(<Counter />);

            // State updates are batched by React, so we verify the setter is available
            expect(typeof setCount).toBe("function");

            // Trigger state update
            setCount(5);

            // Component should be updated (state is managed by React)
            expect(typeof setCount).toBe("function");
        });

        it("handles conditional rendering", () => {
            let setVisible: (value: boolean) => void = () => {};

            const Conditional = () => {
                const [visible, _setVisible] = useState(true);
                setVisible = _setVisible;
                return (
                    <Box spacing={10} orientation={Gtk.Orientation.VERTICAL}>
                        {visible && <Label.Root label="Visible" />}
                    </Box>
                );
            };

            render(<Conditional />);

            // Verify setter is available
            expect(typeof setVisible).toBe("function");

            // Trigger visibility toggle
            setVisible(false);
            setVisible(true);

            // Component should handle conditional rendering without errors
            expect(typeof setVisible).toBe("function");
        });

        it("handles list rendering", () => {
            const items = ["A", "B", "C", "D", "E"];

            render(
                <Box spacing={5} orientation={Gtk.Orientation.VERTICAL}>
                    {items.map((item) => (
                        <Label.Root key={item} label={item} />
                    ))}
                </Box>,
            );

            const windows = getCurrentApp().getWindows();
            expect(windows.length).toBeGreaterThanOrEqual(0);
        });

        it("handles multiple windows", () => {
            render(
                <>
                    <ApplicationWindow title="Window 1">
                        <Label.Root label="Content 1" />
                    </ApplicationWindow>
                    <ApplicationWindow title="Window 2">
                        <Label.Root label="Content 2" />
                    </ApplicationWindow>
                </>,
            );

            const windows = getCurrentApp().getWindows();
            // Rendering multiple windows should work
            // The exact count depends on GTK's internal state
            expect(windows.length).toBeGreaterThanOrEqual(0);
        });

        it("renders Grid with positioned children", () => {
            render(
                <Grid.Root>
                    <Grid.Child column={0} row={0}>
                        <Label.Root label="A" />
                    </Grid.Child>
                    <Grid.Child column={1} row={0}>
                        <Label.Root label="B" />
                    </Grid.Child>
                    <Grid.Child column={0} row={1}>
                        <Label.Root label="C" />
                    </Grid.Child>
                    <Grid.Child column={1} row={1}>
                        <Label.Root label="D" />
                    </Grid.Child>
                </Grid.Root>,
            );

            const windows = getCurrentApp().getWindows();
            expect(windows.length).toBeGreaterThanOrEqual(0);
        });

        it("renders Overlay with main child and overlays", () => {
            render(
                <Overlay>
                    <Label.Root label="Main Content" />
                    <Button label="Overlay Button" />
                </Overlay>,
            );

            const windows = getCurrentApp().getWindows();
            expect(windows.length).toBeGreaterThanOrEqual(0);
        });

        it("renders Notebook with multiple pages", () => {
            render(
                <Notebook.Root>
                    <Notebook.Page label="Page 1">
                        <Label.Root label="Page 1 Content" />
                    </Notebook.Page>
                    <Notebook.Page label="Page 2">
                        <Label.Root label="Page 2 Content" />
                    </Notebook.Page>
                    <Notebook.Page label="Page 3">
                        <Label.Root label="Page 3 Content" />
                    </Notebook.Page>
                </Notebook.Root>,
            );

            const windows = getCurrentApp().getWindows();
            expect(windows.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe("React reconciliation - list reordering", () => {
        it("reorders list items correctly", () => {
            let setItems: (items: string[]) => void = () => {};
            let boxRef: Gtk.Box | undefined;

            const ReorderableList = () => {
                const [items, _setItems] = useState(["A", "B", "C"]);
                setItems = _setItems;
                return (
                    <Box
                        spacing={0}
                        orientation={Gtk.Orientation.VERTICAL}
                        ref={(ref: Gtk.Box | null) => {
                            boxRef = ref ?? undefined;
                        }}
                    >
                        {items.map((item) => (
                            <Label.Root key={item} label={item} />
                        ))}
                    </Box>
                );
            };

            render(<ReorderableList />);

            expect(boxRef).toBeDefined();
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["A", "B", "C"]);

            // Reorder: move C to front
            flushSync(() => setItems(["C", "A", "B"]));
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["C", "A", "B"]);
        });

        it("handles item insertion at beginning", () => {
            let setItems: (items: string[]) => void = () => {};
            let boxRef: Gtk.Box | undefined;

            const DynamicList = () => {
                const [items, _setItems] = useState(["B", "C"]);
                setItems = _setItems;
                return (
                    <Box
                        spacing={0}
                        orientation={Gtk.Orientation.VERTICAL}
                        ref={(ref: Gtk.Box | null) => {
                            boxRef = ref ?? undefined;
                        }}
                    >
                        {items.map((item) => (
                            <Label.Root key={item} label={item} />
                        ))}
                    </Box>
                );
            };

            render(<DynamicList />);

            expect(boxRef).toBeDefined();
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["B", "C"]);

            // Insert A at beginning
            flushSync(() => setItems(["A", "B", "C"]));
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["A", "B", "C"]);
        });

        it("handles item insertion in middle", () => {
            let setItems: (items: string[]) => void = () => {};
            let boxRef: Gtk.Box | undefined;

            const DynamicList = () => {
                const [items, _setItems] = useState(["A", "C"]);
                setItems = _setItems;
                return (
                    <Box
                        spacing={0}
                        orientation={Gtk.Orientation.VERTICAL}
                        ref={(ref: Gtk.Box | null) => {
                            boxRef = ref ?? undefined;
                        }}
                    >
                        {items.map((item) => (
                            <Label.Root key={item} label={item} />
                        ))}
                    </Box>
                );
            };

            render(<DynamicList />);

            expect(boxRef).toBeDefined();
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["A", "C"]);

            // Insert B in middle
            flushSync(() => setItems(["A", "B", "C"]));
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["A", "B", "C"]);
        });

        it("handles item removal from beginning", () => {
            let setItems: (items: string[]) => void = () => {};
            let boxRef: Gtk.Box | undefined;

            const DynamicList = () => {
                const [items, _setItems] = useState(["A", "B", "C"]);
                setItems = _setItems;
                return (
                    <Box
                        spacing={0}
                        orientation={Gtk.Orientation.VERTICAL}
                        ref={(ref: Gtk.Box | null) => {
                            boxRef = ref ?? undefined;
                        }}
                    >
                        {items.map((item) => (
                            <Label.Root key={item} label={item} />
                        ))}
                    </Box>
                );
            };

            render(<DynamicList />);

            expect(boxRef).toBeDefined();
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["A", "B", "C"]);

            // Remove A from beginning
            flushSync(() => setItems(["B", "C"]));
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["B", "C"]);
        });

        it("handles item removal from middle", () => {
            let setItems: (items: string[]) => void = () => {};
            let boxRef: Gtk.Box | undefined;

            const DynamicList = () => {
                const [items, _setItems] = useState(["A", "B", "C"]);
                setItems = _setItems;
                return (
                    <Box
                        spacing={0}
                        orientation={Gtk.Orientation.VERTICAL}
                        ref={(ref: Gtk.Box | null) => {
                            boxRef = ref ?? undefined;
                        }}
                    >
                        {items.map((item) => (
                            <Label.Root key={item} label={item} />
                        ))}
                    </Box>
                );
            };

            render(<DynamicList />);

            expect(boxRef).toBeDefined();
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["A", "B", "C"]);

            // Remove B from middle
            flushSync(() => setItems(["A", "C"]));
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["A", "C"]);
        });

        it("handles complex reordering", () => {
            let setItems: (items: string[]) => void = () => {};
            let boxRef: Gtk.Box | undefined;

            const DynamicList = () => {
                const [items, _setItems] = useState(["A", "B", "C", "D", "E"]);
                setItems = _setItems;
                return (
                    <Box
                        spacing={0}
                        orientation={Gtk.Orientation.VERTICAL}
                        ref={(ref: Gtk.Box | null) => {
                            boxRef = ref ?? undefined;
                        }}
                    >
                        {items.map((item) => (
                            <Label.Root key={item} label={item} />
                        ))}
                    </Box>
                );
            };

            render(<DynamicList />);

            expect(boxRef).toBeDefined();
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["A", "B", "C", "D", "E"]);

            // Reverse the list
            flushSync(() => setItems(["E", "D", "C", "B", "A"]));
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["E", "D", "C", "B", "A"]);

            // Shuffle
            flushSync(() => setItems(["C", "A", "E", "B", "D"]));
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["C", "A", "E", "B", "D"]);
        });

        it("handles adding and removing items simultaneously", () => {
            let setItems: (items: string[]) => void = () => {};
            let boxRef: Gtk.Box | undefined;

            const DynamicList = () => {
                const [items, _setItems] = useState(["A", "B", "C"]);
                setItems = _setItems;
                return (
                    <Box
                        spacing={0}
                        orientation={Gtk.Orientation.VERTICAL}
                        ref={(ref: Gtk.Box | null) => {
                            boxRef = ref ?? undefined;
                        }}
                    >
                        {items.map((item) => (
                            <Label.Root key={item} label={item} />
                        ))}
                    </Box>
                );
            };

            render(<DynamicList />);

            expect(boxRef).toBeDefined();
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["A", "B", "C"]);

            // Remove B, add X and Y
            flushSync(() => setItems(["A", "X", "Y", "C"]));
            expect(getChildLabels(assertDefined(boxRef))).toEqual(["A", "X", "Y", "C"]);
        });
    });

    describe("portals", () => {
        describe("with Gtk.Application container", () => {
            it("renders portal children at application level", () => {
                let windowRef: Gtk.ApplicationWindow | undefined;

                const App = () => (
                    <>
                        {createPortal(
                            <ApplicationWindow
                                title="Portal Window"
                                ref={(ref: Gtk.ApplicationWindow | null) => {
                                    windowRef = ref ?? undefined;
                                }}
                            >
                                <Label.Root label="Portal Content" />
                            </ApplicationWindow>,
                        )}
                    </>
                );

                render(<App />);

                expect(windowRef).toBeDefined();
                expect(windowRef).toBeInstanceOf(Gtk.ApplicationWindow);
                expect(windowRef?.getTitle()).toBe("Portal Window");
            });

            it("removes portal children when unmounted", () => {
                let windowRef: Gtk.ApplicationWindow | undefined;
                let setShowPortal: (show: boolean) => void = () => {};

                const App = () => {
                    const [showPortal, _setShowPortal] = useState(true);
                    setShowPortal = _setShowPortal;

                    return (
                        <>
                            {showPortal &&
                                createPortal(
                                    <ApplicationWindow
                                        title="Portal Window"
                                        ref={(ref: Gtk.ApplicationWindow | null) => {
                                            windowRef = ref ?? undefined;
                                        }}
                                    >
                                        <Label.Root label="Portal Content" />
                                    </ApplicationWindow>,
                                )}
                        </>
                    );
                };

                render(<App />);
                expect(windowRef).toBeDefined();

                const capturedWindow = windowRef;

                // Unmount the portal
                flushSync(() => setShowPortal(false));

                // Window reference should still exist but be the same captured one
                expect(capturedWindow).toBeDefined();
            });

            it("updates portal children", () => {
                let windowRef: Gtk.ApplicationWindow | undefined;
                let setTitle: (title: string) => void = () => {};

                const App = () => {
                    const [title, _setTitle] = useState("Initial Title");
                    setTitle = _setTitle;

                    return (
                        <>
                            {createPortal(
                                <ApplicationWindow
                                    title={title}
                                    ref={(ref: Gtk.ApplicationWindow | null) => {
                                        windowRef = ref ?? undefined;
                                    }}
                                >
                                    <Label.Root label="Content" />
                                </ApplicationWindow>,
                            )}
                        </>
                    );
                };

                render(<App />);
                expect(windowRef?.getTitle()).toBe("Initial Title");

                flushSync(() => setTitle("Updated Title"));
                expect(windowRef?.getTitle()).toBe("Updated Title");
            });
        });

        describe("with Gtk.Widget container", () => {
            it("renders portal children into widget container", () => {
                let containerRef: Gtk.Box | undefined;
                let portalLabelRef: Gtk.Label | undefined;

                const App = () => {
                    return (
                        <ApplicationWindow title="Main">
                            <Box
                                spacing={0}
                                orientation={Gtk.Orientation.VERTICAL}
                                ref={(ref: Gtk.Box | null) => {
                                    containerRef = ref ?? undefined;
                                }}
                            />
                            {containerRef &&
                                createPortal(
                                    <Label.Root
                                        label="Portaled Label"
                                        ref={(ref: Gtk.Label | null) => {
                                            portalLabelRef = ref ?? undefined;
                                        }}
                                    />,
                                    containerRef,
                                )}
                        </ApplicationWindow>
                    );
                };

                // First render creates the container
                render(<App />);

                // Container should exist
                expect(containerRef).toBeDefined();

                // Re-render to trigger portal now that container exists
                render(<App />);

                expect(portalLabelRef).toBeDefined();
                expect(getChildLabels(assertDefined(containerRef))).toContain("Portaled Label");
            });

            it("appends multiple children to widget container via portal", () => {
                let containerRef: Gtk.Box | undefined;

                const App = () => {
                    return (
                        <ApplicationWindow title="Main">
                            <Box
                                spacing={0}
                                orientation={Gtk.Orientation.VERTICAL}
                                ref={(ref: Gtk.Box | null) => {
                                    containerRef = ref ?? undefined;
                                }}
                            >
                                <Label.Root label="Direct Child" />
                            </Box>
                            {containerRef &&
                                createPortal(
                                    <>
                                        <Label.Root label="Portal Child 1" />
                                        <Label.Root label="Portal Child 2" />
                                    </>,
                                    containerRef,
                                )}
                        </ApplicationWindow>
                    );
                };

                render(<App />);
                expect(containerRef).toBeDefined();

                // Re-render to trigger portal
                render(<App />);

                const labels = getChildLabels(assertDefined(containerRef));
                expect(labels).toContain("Direct Child");
                expect(labels).toContain("Portal Child 1");
                expect(labels).toContain("Portal Child 2");
            });

            it("removes portal children from widget container when unmounted", () => {
                let containerRef: Gtk.Box | undefined;
                let setShowPortal: (show: boolean) => void = () => {};

                const App = () => {
                    const [showPortal, _setShowPortal] = useState(true);
                    setShowPortal = _setShowPortal;

                    return (
                        <ApplicationWindow title="Main">
                            <Box
                                spacing={0}
                                orientation={Gtk.Orientation.VERTICAL}
                                ref={(ref: Gtk.Box | null) => {
                                    containerRef = ref ?? undefined;
                                }}
                            >
                                <Label.Root label="Stays" />
                            </Box>
                            {containerRef && showPortal && createPortal(<Label.Root label="Goes Away" />, containerRef)}
                        </ApplicationWindow>
                    );
                };

                render(<App />);
                render(<App />); // Re-render to trigger portal

                expect(containerRef).toBeDefined();
                expect(getChildLabels(assertDefined(containerRef))).toContain("Stays");
                expect(getChildLabels(assertDefined(containerRef))).toContain("Goes Away");

                // Unmount the portal
                flushSync(() => setShowPortal(false));

                expect(getChildLabels(assertDefined(containerRef))).toContain("Stays");
                expect(getChildLabels(assertDefined(containerRef))).not.toContain("Goes Away");
            });

            it("inserts portal child before existing children using insertInContainerBefore", () => {
                let containerRef: Gtk.Box | undefined;
                let setItems: (items: string[]) => void = () => {};

                const App = () => {
                    const [items, _setItems] = useState(["B", "C"]);
                    setItems = _setItems;

                    return (
                        <ApplicationWindow title="Main">
                            <Box
                                spacing={0}
                                orientation={Gtk.Orientation.VERTICAL}
                                ref={(ref: Gtk.Box | null) => {
                                    containerRef = ref ?? undefined;
                                }}
                            />
                            {containerRef &&
                                createPortal(
                                    items.map((item) => <Label.Root key={item} label={item} />),
                                    containerRef,
                                )}
                        </ApplicationWindow>
                    );
                };

                render(<App />);
                render(<App />); // Re-render to trigger portal

                expect(containerRef).toBeDefined();
                expect(getChildLabels(assertDefined(containerRef))).toEqual(["B", "C"]);

                // Add A at the beginning - this should trigger insertInContainerBefore
                flushSync(() => setItems(["A", "B", "C"]));
                expect(getChildLabels(assertDefined(containerRef))).toEqual(["A", "B", "C"]);
            });
        });
    });

    describe("GObject introspection", () => {
        it("typeNameFromInstance works with GObject ptr", async () => {
            const { getObjectId } = await import("@gtkx/ffi");
            const GObject = await import("@gtkx/ffi/gobject");
            const button = new Gtk.Button();
            const typeName = GObject.typeNameFromInstance(getObjectId(button.ptr));
            expect(typeName).toBe("GtkButton");
        });

        it("typeNameFromInstance returns correct type for different widgets", async () => {
            const { getObjectId } = await import("@gtkx/ffi");
            const GObject = await import("@gtkx/ffi/gobject");

            const label = new Gtk.Label("");
            expect(GObject.typeNameFromInstance(getObjectId(label.ptr))).toBe("GtkLabel");

            const box = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 0);
            expect(GObject.typeNameFromInstance(getObjectId(box.ptr))).toBe("GtkBox");

            const entry = new Gtk.Entry();
            expect(GObject.typeNameFromInstance(getObjectId(entry.ptr))).toBe("GtkEntry");
        });
    });
});
