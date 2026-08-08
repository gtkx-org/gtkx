import type { MockInstance } from "vitest";
import { DropDown } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectMultiSelectionAdopted } from "./helpers/list-collection-render.js";
import { renderStatefulListView, valueItems } from "./helpers/list-fixtures.js";

type Category = {
    id: string;
    value: { name: string };
    children: { id: string; value: { name: string }; shouldHideExpander: true }[];
};

const tree: Category[] = [
    {
        id: "cat-a",
        value: { name: "Category A" },
        children: [
            { id: "a-1", value: { name: "Alpha" }, shouldHideExpander: true },
            { id: "a-2", value: { name: "Beta" }, shouldHideExpander: true },
        ],
    },
];

const expandableExpanders = (): Gtk.TreeExpander[] =>
    screen
        .queryAllByRole(Gtk.AccessibleRole.BUTTON, { as: Gtk.TreeExpander })
        .filter((widget) => widget.getListRow()?.isExpandable() ?? false);

const expectNoActWarning = (errorSpy: MockInstance<typeof console.error>): void => {
    const isWarned = errorSpy.mock.calls.some((args: unknown[]) =>
        args.some((arg) => typeof arg === "string" && arg.includes("not wrapped in act")),
    );

    expect(isWarned).toBe(false);
};

const expectTreeToggleHasNoActWarning = async (errorSpy: MockInstance<typeof console.error>): Promise<void> => {
    await renderStatefulListView(tree, { estimatedItemHeight: 48 });
    const row = expandableExpanders()[0]?.getListRow();

    if (!row) {
        throw new Error("expected an expandable tree row");
    }

    await act(() => {
        row.setExpanded(true);
    });

    await screen.findAllByText("Alpha");

    await act(() => {
        row.setExpanded(false);
    });

    expectNoActWarning(errorSpy);
};

const expectMultiSelectionHasNoActWarning = async (errorSpy: MockInstance<typeof console.error>): Promise<void> => {
    await expectMultiSelectionAdopted();
    expectNoActWarning(errorSpy);
};

const expectDropdownSelectionHasNoActWarning = async (
    errorSpy: MockInstance<typeof console.error>,
): Promise<void> => {
    const onSelectionChanged = vi.fn();

    await render(
        <DropDown onSelectionChanged={onSelectionChanged} items={valueItems(["Option 1", "Option 2", "Option 3"])} />,
    );

    await screen.findAllByText("Option 1");
    await userEvent.selectOptions(screen.getByRole(Gtk.AccessibleRole.COMBO_BOX), [2]);
    await screen.findAllByText("Option 3");
    expect(onSelectionChanged).toHaveBeenCalledWith("3");
    expectNoActWarning(errorSpy);
};

describe("act safety", () => {
    let errorSpy: MockInstance<typeof console.error>;

    beforeEach(() => {
        errorSpy = vi.spyOn(console, "error");
    });

    afterEach(() => {
        errorSpy.mockRestore();
    });

    it("expands and collapses a tree row without an act warning", async () => {
        await expectTreeToggleHasNoActWarning(errorSpy);
    });

    it("changes a multi-selection without an act warning", async () => {
        await expectMultiSelectionHasNoActWarning(errorSpy);
    });

    it("changes a dropdown selection without an act warning", async () => {
        await expectDropdownSelectionHasNoActWarning(errorSpy);
    });
});
