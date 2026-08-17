import type { ListItem } from "@gtkx/components";
import type { RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { act, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import type { TreeName } from "./helpers/trees.js";
import { renderListView, renderStatefulListView } from "./helpers/list-fixtures.js";
import { expectRowTexts } from "./helpers/row-texts.js";
import { getSelectionModel, getTreeRow } from "./helpers/selection-model.js";
import { treeBranch, treeLeaf } from "./helpers/trees.js";

const BOTH_BRANCHES = ["p", "dup"];
const NESTED_ONLY = ["p"];
const LEAF_POSITIONS = [0, 1, 2];

const named = (id: string, name: string): ListItem<TreeName> => ({ id, value: { name } });

const namedBranch = (id: string, name: string, children: ListItem<TreeName>[]): ListItem<TreeName> => ({
    id,
    value: { name },
    children,
});

const repeatedTree = (): ListItem<TreeName>[] => [
    treeBranch("p", [treeBranch("dup", [treeLeaf("x")])]),
    treeBranch("dup", [treeLeaf("y")]),
];

const crossLevelTree = (): ListItem<TreeName>[] => [
    namedBranch("a", "branchA", [named("b", "realChild")]),
    named("b", "rootTwin"),
];

const repeatedLeafTree = (): ListItem<TreeName>[] => [treeBranch("p", [treeLeaf("leaf")]), treeLeaf("leaf")];
const shiftingTree = (): ListItem<TreeName>[] => [treeBranch("p", [treeLeaf("x")]), treeLeaf("y")];

const expectSelectedPositions = (ref: RefObject<Gtk.ListView>, expected: number[]): Promise<void> =>
    waitFor(() => {
        const model = getSelectionModel(ref);
        expect(LEAF_POSITIONS.filter((position) => model.isSelected(position))).toEqual(expected);
    });

describe("ListView tree with repeated ids", () => {
    it("draws each row from its own value and gives each branch its own children", async () => {
        const nested = await renderListView<TreeName>(
            [namedBranch("p", "p", [named("dup", "nested")]), named("dup", "root")],
            { expandedIds: NESTED_ONLY },
        );

        await expectRowTexts(nested.ref, ["p", "nested", "root"]);

        const siblings = await renderListView<TreeName>(
            [namedBranch("dup", "first", [treeLeaf("a")]), namedBranch("dup", "second", [treeLeaf("b")])],
            { expandedIds: ["dup"] },
        );

        await expectRowTexts(siblings.ref, ["first", "a", "second", "b"]);

        const childless = await renderListView<TreeName>(
            [namedBranch("d", "withKids", [named("k", "kid")]), named("d", "noKids")],
            { expandedIds: ["d"] },
        );

        await expectRowTexts(childless.ref, ["withKids", "kid", "noKids"]);
    });

    it("keeps rows apart when every id is the empty string", async () => {
        const items = [namedBranch("", "blankBranch", [named("k", "kid")]), named("", "blankLeaf")];
        const { ref } = await renderListView<TreeName>(items, { expandedIds: [""] });
        await expectRowTexts(ref, ["blankBranch", "kid", "blankLeaf"]);
    });

    it("keeps a root twin away from another branch's children", async () => {
        const { ref } = await renderListView<TreeName>(crossLevelTree(), { expandedIds: ["a"] });
        await expectRowTexts(ref, ["branchA", "realChild", "rootTwin"]);
    });
});

describe("ListView tree expansion over repeated ids", () => {
    it("expands every row a repeated id names and reports each of them", async () => {
        const onExpandedChange = vi.fn();

        const { ref, rerender } = await renderListView<TreeName>(repeatedTree(), {
            expandedIds: BOTH_BRANCHES,
            onExpandedChange,
        });

        await expectRowTexts(ref, ["p", "dup", "x", "dup", "y"]);
        expect(onExpandedChange).toHaveBeenLastCalledWith(["p", "dup", "dup"]);
        await rerender(repeatedTree(), { expandedIds: NESTED_ONLY });
        await expectRowTexts(ref, ["p", "dup", "dup"]);
    });

    it("expands every sibling the toggled row's id names once the report is adopted", async () => {
        const { ref } = await renderStatefulListView<TreeName>([
            namedBranch("dup", "first", [treeLeaf("a")]),
            namedBranch("dup", "second", [treeLeaf("b")]),
        ]);

        await expectRowTexts(ref, ["first", "second"]);

        await act(() => {
            getTreeRow(getSelectionModel(ref), 1).setExpanded(true);
        });

        await expectRowTexts(ref, ["first", "a", "second", "b"]);
    });
});

describe("ListView tree selection over repeated ids", () => {
    it("selects every row a repeated id names when the view allows it", async () => {
        const onSelectionChanged = vi.fn();

        const { ref } = await renderListView<TreeName>(repeatedLeafTree(), {
            expandedIds: NESTED_ONLY,
            selected: ["leaf"],
            selectionMode: Gtk.SelectionMode.MULTIPLE,
            onSelectionChanged,
        });

        await expectSelectedPositions(ref, [1, 2]);
        expect(onSelectionChanged).toHaveBeenLastCalledWith(["leaf", "leaf"]);
    });

    it("selects the first row a repeated id names when only one row may be selected", async () => {
        const { ref } = await renderListView<TreeName>(repeatedLeafTree(), {
            expandedIds: NESTED_ONLY,
            selected: ["leaf"],
        });

        await expectSelectedPositions(ref, [1]);
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

        await rerender(items, { ...options, expandedIds: NESTED_ONLY });
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

        await act(() => {
            getTreeRow(getSelectionModel(ref), 0).setExpanded(true);
        });

        await expectRowTexts(ref, ["p", "x", "y"]);

        await waitFor(() => {
            expect(getSelectionModel(ref).isSelected(2)).toBe(true);
        });

        expect(onSelectionChanged).toHaveBeenLastCalledWith(["y"]);
    });
});
