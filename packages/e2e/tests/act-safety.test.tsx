import * as Gtk from "@gtkx/gi/gtk";
import { GtkDropDown } from "@gtkx/jsx/gtk";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderListView } from "./helpers/list-fixtures.js";

interface Category {
    id: string;
    value: { name: string };
    children: Array<{ id: string; value: { name: string }; hideExpander: true }>;
}

const tree: Category[] = [
    {
        id: "cat-a",
        value: { name: "Category A" },
        children: [
            { id: "a-1", value: { name: "Alpha" }, hideExpander: true },
            { id: "a-2", value: { name: "Beta" }, hideExpander: true },
        ],
    },
];

const expandableExpanders = (): Gtk.TreeExpander[] =>
    screen
        .queryAllByRole(Gtk.AccessibleRole.BUTTON)
        .filter((widget): widget is Gtk.TreeExpander => widget instanceof Gtk.TreeExpander)
        .filter((widget) => widget.getListRow()?.isExpandable() ?? false);

const valueItems = (values: string[]): Array<{ id: string; value: string }> =>
    values.map((value, index) => ({ id: String(index + 1), value }));

describe("act safety", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        errorSpy = vi.spyOn(console, "error");
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    const assertNoActWarning = (): void => {
        const warned = errorSpy.mock.calls.some((args: unknown[]) =>
            args.some((arg) => typeof arg === "string" && arg.includes("not wrapped in act")),
        );
        expect(warned).toBe(false);
    };

    it("expands and collapses a tree row without an act warning", async () => {
        await renderListView(tree, { estimatedItemHeight: 48 });

        const row = expandableExpanders()[0]?.getListRow();
        if (!row) throw new Error("expected an expandable tree row");

        await act(() => row.setExpanded(true));
        await screen.findAllByText("Alpha");

        await act(() => row.setExpanded(false));

        assertNoActWarning();
    });

    it("changes a multi-selection without an act warning", async () => {
        const onSelectionChanged = vi.fn();
        const { ref } = await renderListView(
            [
                { id: "1", value: { name: "First" } },
                { id: "2", value: { name: "Second" } },
            ],
            { selectionMode: Gtk.SelectionMode.MULTIPLE, onSelectionChanged },
        );

        await userEvent.selectOptions(ref.current, [0, 1]);

        expect(onSelectionChanged).toHaveBeenCalledWith(["1", "2"]);
        assertNoActWarning();
    });

    it("changes a dropdown selection without an act warning", async () => {
        const dropDownRef = createRef<Gtk.DropDown>();
        const onSelectionChanged = vi.fn();

        await render(
            <GtkDropDown
                ref={dropDownRef}
                onSelectionChanged={onSelectionChanged}
                items={valueItems(["Option 1", "Option 2", "Option 3"])}
            />,
        );
        await screen.findAllByText("Option 1");

        await act(() => dropDownRef.current?.setSelected(2));
        await screen.findAllByText("Option 3");

        expect(onSelectionChanged).toHaveBeenCalledWith("3");
        assertNoActWarning();
    });
});
