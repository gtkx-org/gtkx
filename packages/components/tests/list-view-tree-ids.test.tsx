import type { ListItem } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import type { TreeName } from "./helpers/trees.js";
import { expanderNamed } from "./helpers/expanders.js";
import { renderListView, renderStatefulListView } from "./helpers/list-fixtures.js";
import { expectRowTexts } from "./helpers/row-texts.js";
import { getSelectionModel } from "./helpers/selection-model.js";
import { treeBranch, treeLeaf } from "./helpers/trees.js";

const PARENT_EXPANDED = ["p"];

const named = (id: string, name: string): ListItem<TreeName> => ({ id, value: { name } });

const namedBranch = (id: string, name: string, children: ListItem<TreeName>[]): ListItem<TreeName> => ({
    id,
    value: { name },
    children,
});

const shiftingTree = (): ListItem<TreeName>[] => [treeBranch("p", [treeLeaf("x")]), treeLeaf("y")];

describe("ListView tree identity", () => {
    it("expands only the requested branch when row labels match", async () => {
        const items = [
            namedBranch("first", "Branch", [treeLeaf("First child")]),
            namedBranch("second", "Branch", [treeLeaf("Second child")]),
        ];
        const { ref, rerender } = await renderListView<TreeName>(items, { expandedIds: ["first"] });
        await expectRowTexts(ref, ["Branch", "First child", "Branch"]);
        await rerender(items, { expandedIds: ["second"] });
        await expectRowTexts(ref, ["Branch", "Branch", "Second child"]);
    });

    it("tells apart id sets that join to the same spelling", async () => {
        const onSelectionChanged = vi.fn();
        const items = [named("a b", "AB"), named("a", "A"), named("b", "B")];

        const { rerender } = await renderListView<TreeName>(items, {
            selectionMode: Gtk.SelectionMode.MULTIPLE,
            selected: ["a", "b"],
            onSelectionChanged,
        });

        await waitFor(() => {
            expect(onSelectionChanged).toHaveBeenLastCalledWith(["a", "b"]);
        });

        await rerender(items, { selected: ["a b"] });

        await waitFor(() => {
            expect(onSelectionChanged).toHaveBeenLastCalledWith(["a b"]);
        });
    });
});
describe("ListView tree selection while rows shift", () => {
    it("keeps reporting the selected id after a controlled expansion moves it down", async () => {
        const onSelectionChanged = vi.fn();
        const items = shiftingTree();

        const options = {
            selected: ["y"],
            selectionMode: Gtk.SelectionMode.MULTIPLE,
            onSelectionChanged,
        };

        const { ref, rerender } = await renderListView<TreeName>(items, { ...options, expandedIds: [] });

        await waitFor(() => {
            expect(getSelectionModel(ref).isSelected(1)).toBe(true);
        });

        await rerender(items, { ...options, expandedIds: PARENT_EXPANDED });
        await expectRowTexts(ref, ["p", "x", "y"]);

        await waitFor(() => {
            const model = getSelectionModel(ref);
            expect(model.isSelected(2)).toBe(true);
            expect(model.isSelected(1)).toBe(false);
        });

        expect(onSelectionChanged).toHaveBeenLastCalledWith(["y"]);
    });

    it("keeps reporting the selected id after the widget expands a branch on its own", async () => {
        const onSelectionChanged = vi.fn();
        const items = shiftingTree();

        const { ref } = await renderStatefulListView<TreeName>(items, {
            selected: ["y"],
            selectionMode: Gtk.SelectionMode.MULTIPLE,
            onSelectionChanged,
        });

        await waitFor(() => {
            expect(getSelectionModel(ref).isSelected(1)).toBe(true);
        });

        await userEvent.click(expanderNamed("p"));

        await expectRowTexts(ref, ["p", "x", "y"]);

        await waitFor(() => {
            expect(getSelectionModel(ref).isSelected(2)).toBe(true);
        });

        expect(onSelectionChanged).toHaveBeenLastCalledWith(["y"]);
    });
});
