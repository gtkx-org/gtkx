import type { ListItem } from "@gtkx/components";
import type { RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { act, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import type { TreeFixture, TreeName, TreeOptions } from "./helpers/tree-fixtures.js";
import { renderListView, renderStatefulListView } from "./helpers/list-fixtures.js";
import { expectRowTexts } from "./helpers/row-texts.js";
import { getSelectionModel, getTreeRow } from "./helpers/selection-model.js";
import { treeBranch, treeLeaf } from "./helpers/tree-fixtures.js";

const BOTH_BRANCHES = ["p", "dup"];
const NESTED_ONLY = ["p"];
const REPEATED_LEAF = ["leaf"];
const TWICE_REPEATED_LEAF = ["leaf", "leaf"];
const DUP_BRANCH = ["dup"];
const NOTHING: string[] = [];
const EXPANDED_ROWS = ["p", "dup", "x", "dup", "y"];
const COLLAPSED_ROWS = ["p", "dup", "dup"];
const LEAF_POSITIONS = [0, 1, 2];

const repeatedLeafTree = (): ListItem<TreeName>[] => [treeBranch("p", [treeLeaf("leaf")]), treeLeaf("leaf")];

const repeatedTree = (): ListItem<TreeName>[] => [
    treeBranch("p", [treeBranch("dup", [treeLeaf("x")])]),
    treeBranch("dup", [treeLeaf("y")]),
];

const named = (id: string, name: string): ListItem<TreeName> => ({ id, value: { name } });

const namedBranch = (id: string, name: string, children: ListItem<TreeName>[]): ListItem<TreeName> => ({
    id,
    value: { name },
    children,
});

const repeatedValueTree = (): ListItem<TreeName>[] => [
    { id: "p", value: { name: "p" }, children: [named("dup", "nested")] },
    named("dup", "root"),
];

const siblingTree = (): ListItem<TreeName>[] => [named("s", "one"), named("s", "two"), named("t", "three")];

const siblingBranchTree = (): ListItem<TreeName>[] => [
    namedBranch("dup", "first", [treeLeaf("a")]),
    namedBranch("dup", "second", [treeLeaf("b")]),
];

const crossLevelTree = (): ListItem<TreeName>[] => [
    namedBranch("a", "branchA", [named("b", "realChild")]),
    named("b", "rootTwin"),
];

const growingTree = (extra: ListItem<TreeName>[]): ListItem<TreeName>[] => [
    ...extra,
    treeBranch("a", [treeLeaf("a0")]),
    treeLeaf("z"),
];

const renderRepeated = (options: TreeOptions): Promise<TreeFixture> =>
    renderListView<TreeName>(repeatedTree(), options);

const renderRepeatedLeaf = (options: TreeOptions) =>
    renderListView<TreeName>(repeatedLeafTree(), { expandedIds: NESTED_ONLY, selected: REPEATED_LEAF, ...options });

const expandRow = async (ref: RefObject<Gtk.ListView | null>, position: number): Promise<void> => {
    await act(() => {
        getTreeRow(getSelectionModel(ref), position).setExpanded(true);
    });
};

const renderExpandedBranch = async (leading: ListItem<TreeName>[]) => {
    const fixture = await renderStatefulListView<TreeName>(growingTree(leading));
    await expandRow(fixture.ref, leading.length);

    return fixture;
};

const expectSelectedPositions = (ref: RefObject<Gtk.ListView>, expected: number[]): Promise<void> =>
    waitFor(() => {
        const model = getSelectionModel(ref);
        expect(LEAF_POSITIONS.filter((position) => model.isSelected(position))).toEqual(expected);
    });

describe("render - ListView (tree) - ids repeated in different levels", () => {
    it("gives each repeated branch its own children", async () => {
        const fixture = await renderRepeated({ expandedIds: BOTH_BRANCHES });
        await expectRowTexts(fixture.ref, EXPANDED_ROWS);
    });

    it("keeps each repeated branch collapsible on its own", async () => {
        const fixture = await renderRepeated({ expandedIds: BOTH_BRANCHES });
        await fixture.rerender(repeatedTree(), { expandedIds: NESTED_ONLY });
        await expectRowTexts(fixture.ref, COLLAPSED_ROWS);
    });

    it("renders each repeated row from its own item value", async () => {
        const fixture = await renderListView<TreeName>(repeatedValueTree(), { expandedIds: NESTED_ONLY });
        await expectRowTexts(fixture.ref, ["p", "nested", "root"]);
    });

    it("reports every row an expanded id names", async () => {
        const onExpandedChange = vi.fn();
        const fixture = await renderRepeated({ expandedIds: BOTH_BRANCHES, onExpandedChange });
        await expectRowTexts(fixture.ref, EXPANDED_ROWS);
        expect(onExpandedChange).toHaveBeenLastCalledWith(COLLAPSED_ROWS);
    });
});

describe("render - ListView (tree) - ids repeated among siblings", () => {
    it("renders each repeated sibling from its own item value", async () => {
        const fixture = await renderListView<TreeName>(siblingTree(), { expandedIds: NOTHING });
        await expectRowTexts(fixture.ref, ["one", "two", "three"]);
    });

    it("gives each repeated sibling branch its own children", async () => {
        const fixture = await renderListView<TreeName>(siblingBranchTree(), { expandedIds: DUP_BRANCH });
        await expectRowTexts(fixture.ref, ["first", "a", "second", "b"]);
    });

    it("keeps repeated sibling branches apart while collapsed", async () => {
        const fixture = await renderListView<TreeName>(siblingBranchTree(), { expandedIds: NOTHING });
        await expectRowTexts(fixture.ref, ["first", "second"]);
    });

    it("expands every sibling the toggled row's id names once the report is adopted", async () => {
        const { ref } = await renderStatefulListView<TreeName>(siblingBranchTree());
        await expectRowTexts(ref, ["first", "second"]);
        await expandRow(ref, 1);
        await expectRowTexts(ref, ["first", "a", "second", "b"]);
    });

    it("leaves a childless sibling childless when it shares the branch's id", async () => {
        const items = [namedBranch("d", "withKids", [named("k", "kid")]), named("d", "noKids")];
        const fixture = await renderListView<TreeName>(items, { expandedIds: ["d"] });
        await expectRowTexts(fixture.ref, ["withKids", "kid", "noKids"]);
    });

    it("keeps siblings apart when every id is the empty string", async () => {
        const items = [namedBranch("", "blankBranch", [named("k", "kid")]), named("", "blankLeaf")];
        const fixture = await renderListView<TreeName>(items, { expandedIds: [""] });
        await expectRowTexts(fixture.ref, ["blankBranch", "kid", "blankLeaf"]);
    });

    it("keeps a repeated sibling pair apart from the same id nested elsewhere", async () => {
        const items = [
            namedBranch("p", "P", [named("dup", "underP")]),
            namedBranch("dup", "rootA", [named("x", "xOfA")]),
            namedBranch("dup", "rootB", [named("y", "yOfB")]),
        ];

        const fixture = await renderListView<TreeName>(items, { expandedIds: BOTH_BRANCHES });
        await expectRowTexts(fixture.ref, ["P", "underP", "rootA", "xOfA", "rootB", "yOfB"]);
    });
});

describe("render - ListView (tree) - an id repeated across levels", () => {
    it("keeps a root twin away from another branch's children", async () => {
        const fixture = await renderListView<TreeName>(crossLevelTree(), { expandedIds: ["a"] });
        await expectRowTexts(fixture.ref, ["branchA", "realChild", "rootTwin"]);
    });

    it("selects every row the repeated id names across levels", async () => {
        const onSelectionChanged = vi.fn();

        const { ref } = await renderListView<TreeName>(crossLevelTree(), {
            expandedIds: ["a"],
            selectionMode: Gtk.SelectionMode.MULTIPLE,
            selected: ["b"],
            onSelectionChanged,
        });

        await expectSelectedPositions(ref, [1, 2]);
        expect(onSelectionChanged).toHaveBeenLastCalledWith(["b", "b"]);
    });

    it("expands every branch the repeated id names across levels", async () => {
        const onExpandedChange = vi.fn();

        const items = [
            namedBranch("a", "branchA", [namedBranch("b", "nestedB", [named("x", "xLeaf")])]),
            namedBranch("b", "rootB", [named("y", "yLeaf")]),
        ];

        const fixture = await renderListView<TreeName>(items, { expandedIds: ["a", "b"], onExpandedChange });
        await expectRowTexts(fixture.ref, ["branchA", "nestedB", "xLeaf", "rootB", "yLeaf"]);
        expect(onExpandedChange).toHaveBeenLastCalledWith(["a", "b", "b"]);
    });
});

describe("render - ListView (tree) - expansion survives unrelated structure changes", () => {
    it("keeps a row expanded when a sibling is inserted before it", async () => {
        const { ref, rerender } = await renderExpandedBranch([]);
        await expectRowTexts(ref, ["a", "a0", "z"]);
        await rerender(growingTree([treeLeaf("y")]));
        await expectRowTexts(ref, ["y", "a", "a0", "z"]);
    });

    it("keeps a row expanded when a sibling moves across it", async () => {
        const { ref, rerender } = await renderExpandedBranch([]);
        await rerender([treeLeaf("z"), treeBranch("a", [treeLeaf("a0")])]);
        await expectRowTexts(ref, ["z", "a", "a0"]);
    });

    it("keeps a row expanded when a sibling moves past it from the other side", async () => {
        const { ref, rerender } = await renderExpandedBranch([treeLeaf("y")]);
        await rerender([treeBranch("a", [treeLeaf("a0")]), treeLeaf("z"), treeLeaf("y")]);
        await expectRowTexts(ref, ["a", "a0", "z", "y"]);
    });
});

describe("render - ListView (tree) - reports built from ids that share a joined spelling", () => {
    it("reports a selection change between id sets that join alike", async () => {
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

    it("reports an expansion change between id sets that join alike", async () => {
        const onExpandedChange = vi.fn();
        const items = [namedBranch("a b", "AB", [named("c1", "c1")]), namedBranch("a", "A", [named("c2", "c2")])];
        const fixture = await renderListView<TreeName>(items, { expandedIds: ["a"], onExpandedChange });
        await expectRowTexts(fixture.ref, ["AB", "A", "c2"]);
        await fixture.rerender(items, { expandedIds: ["a b"] });
        await expectRowTexts(fixture.ref, ["AB", "c1", "A"]);

        await waitFor(() => {
            expect(onExpandedChange).toHaveBeenLastCalledWith(["a b"]);
        });
    });
});

describe("render - ListView (tree) - a selected id that names several rows", () => {
    it("selects every row the id names when the view allows it", async () => {
        const onSelectionChanged = vi.fn();
        const { ref } = await renderRepeatedLeaf({ selectionMode: Gtk.SelectionMode.MULTIPLE, onSelectionChanged });
        await expectSelectedPositions(ref, [1, 2]);
        expect(onSelectionChanged).toHaveBeenLastCalledWith(["leaf", "leaf"]);
    });

    it("selects the first row the id names when only one row may be selected", async () => {
        const { ref } = await renderRepeatedLeaf({});
        await expectSelectedPositions(ref, [1]);
    });

    it("settles without re-asserting when the reported ids are fed back in", async () => {
        const setSelection = vi.spyOn(Gtk.MultiSelection.prototype, "setSelection");

        try {
            const { ref } = await renderRepeatedLeaf({
                selectionMode: Gtk.SelectionMode.MULTIPLE,
                selected: TWICE_REPEATED_LEAF,
            });

            await expectSelectedPositions(ref, [1, 2]);
            expect(setSelection).toHaveBeenCalledTimes(1);
        } finally {
            setSelection.mockRestore();
        }
    });
});
