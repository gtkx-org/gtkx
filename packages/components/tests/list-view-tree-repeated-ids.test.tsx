import type { ListItem } from "@gtkx/components";
import type { RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { act, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import type { RenderListViewOptions } from "./helpers/list-fixtures.js";
import type { TreeListFixture, TreeName } from "./helpers/tree-list-app.js";
import { renderListView } from "./helpers/list-fixtures.js";
import { expectRowTexts } from "./helpers/row-texts.js";
import { getSelectionModel, getTreeRow } from "./helpers/selection-model.js";
import { renderTreeList, treeBranch, treeLeaf } from "./helpers/tree-list-app.js";

const KEY_SEPARATOR = String.fromCodePoint(1);
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

const forgedTree = (): ListItem<TreeName>[] => [
    namedBranch("a", "branchA", [named("b", "realChild")]),
    named(`a${KEY_SEPARATOR}b`, "forged"),
];

const growingTree = (extra: ListItem<TreeName>[]): ListItem<TreeName>[] => [
    ...extra,
    treeBranch("a", [treeLeaf("a0")]),
    treeLeaf("z"),
];

const renderRepeated = (expandedIds: string[], onExpandedChange?: (ids: string[]) => void): Promise<TreeListFixture> =>
    renderTreeList({ items: repeatedTree(), expandedIds, onExpandedChange });

const renderRepeatedLeaf = (options: RenderListViewOptions<TreeName>) =>
    renderListView<TreeName>(repeatedLeafTree(), { expandedIds: NESTED_ONLY, selected: REPEATED_LEAF, ...options });

const expandRow = async (ref: RefObject<Gtk.ListView | null>, position: number): Promise<void> => {
    await act(() => {
        getTreeRow(getSelectionModel(ref), position).setExpanded(true);
    });
};

const renderExpandedBranch = async (leading: ListItem<TreeName>[]) => {
    const fixture = await renderListView<TreeName>(growingTree(leading));
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
        const fixture = await renderRepeated(BOTH_BRANCHES);
        await expectRowTexts(fixture.listRef, EXPANDED_ROWS);
    });

    it("keeps each repeated branch collapsible on its own", async () => {
        const fixture = await renderRepeated(BOTH_BRANCHES);
        await fixture.show({ items: repeatedTree(), expandedIds: NESTED_ONLY });
        await expectRowTexts(fixture.listRef, COLLAPSED_ROWS);
    });

    it("renders each repeated row from its own item value", async () => {
        const fixture = await renderTreeList({ items: repeatedValueTree(), expandedIds: NESTED_ONLY });
        await expectRowTexts(fixture.listRef, ["p", "nested", "root"]);
    });

    it("reports every row an expanded id names", async () => {
        const onExpandedChange = vi.fn();
        const fixture = await renderRepeated(BOTH_BRANCHES, onExpandedChange);
        await expectRowTexts(fixture.listRef, EXPANDED_ROWS);
        expect(onExpandedChange).toHaveBeenLastCalledWith(COLLAPSED_ROWS);
    });
});

describe("render - ListView (tree) - ids repeated among siblings", () => {
    it("renders each repeated sibling from its own item value", async () => {
        const fixture = await renderTreeList({ items: siblingTree(), expandedIds: NOTHING });
        await expectRowTexts(fixture.listRef, ["one", "two", "three"]);
    });

    it("gives each repeated sibling branch its own children", async () => {
        const fixture = await renderTreeList({ items: siblingBranchTree(), expandedIds: DUP_BRANCH });
        await expectRowTexts(fixture.listRef, ["first", "a", "second", "b"]);
    });

    it("keeps repeated sibling branches apart while collapsed", async () => {
        const fixture = await renderTreeList({ items: siblingBranchTree(), expandedIds: NOTHING });
        await expectRowTexts(fixture.listRef, ["first", "second"]);
    });

    it("expands only the sibling whose row was toggled", async () => {
        const { ref } = await renderListView<TreeName>(siblingBranchTree());
        await expectRowTexts(ref, ["first", "second"]);
        await expandRow(ref, 1);
        await expectRowTexts(ref, ["first", "second", "b"]);
    });

    it("leaves a childless sibling childless when it shares the branch's id", async () => {
        const items = [namedBranch("d", "withKids", [named("k", "kid")]), named("d", "noKids")];
        const fixture = await renderTreeList({ items, expandedIds: ["d"] });
        await expectRowTexts(fixture.listRef, ["withKids", "kid", "noKids"]);
    });

    it("keeps siblings apart when every id is the empty string", async () => {
        const items = [namedBranch("", "blankBranch", [named("k", "kid")]), named("", "blankLeaf")];
        const fixture = await renderTreeList({ items, expandedIds: [""] });
        await expectRowTexts(fixture.listRef, ["blankBranch", "kid", "blankLeaf"]);
    });

    it("keeps a repeated sibling pair apart from the same id nested elsewhere", async () => {
        const items = [
            namedBranch("p", "P", [named("dup", "underP")]),
            namedBranch("dup", "rootA", [named("x", "xOfA")]),
            namedBranch("dup", "rootB", [named("y", "yOfB")]),
        ];

        const fixture = await renderTreeList({ items, expandedIds: BOTH_BRANCHES });
        await expectRowTexts(fixture.listRef, ["P", "underP", "rootA", "xOfA", "rootB", "yOfB"]);
    });
});

describe("render - ListView (tree) - an id spelled like an internal key", () => {
    it("keeps a forged id away from another branch's children", async () => {
        const fixture = await renderTreeList({ items: forgedTree(), expandedIds: ["a"] });
        await expectRowTexts(fixture.listRef, ["branchA", "realChild", "forged"]);
    });

    it("keeps an id spelling a whole encoded child key distinct", async () => {
        const childKey = `1${KEY_SEPARATOR}a1${KEY_SEPARATOR}01${KEY_SEPARATOR}b1${KEY_SEPARATOR}0`;

        const items = [
            namedBranch("a", "branchA", [named("b", "realChild")]),
            named(childKey, "forgedFullKey"),
        ];

        const fixture = await renderTreeList({ items, expandedIds: ["a"] });
        await expectRowTexts(fixture.listRef, ["branchA", "realChild", "forgedFullKey"]);
    });

    it("keeps digit-only ids that could pass for length prefixes apart", async () => {
        const items = [
            named("1", "one"),
            named(`1${KEY_SEPARATOR}1`, "oneSepOne"),
            named("11", "eleven"),
            named("", "blank"),
        ];

        const fixture = await renderTreeList({ items, expandedIds: NOTHING });
        await expectRowTexts(fixture.listRef, ["one", "oneSepOne", "eleven", "blank"]);
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
        const fixture = await renderTreeList({ items, expandedIds: ["a"], onExpandedChange });
        await expectRowTexts(fixture.listRef, ["AB", "A", "c2"]);
        await fixture.show({ items, expandedIds: ["a b"], onExpandedChange });
        await expectRowTexts(fixture.listRef, ["AB", "c1", "A"]);

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
