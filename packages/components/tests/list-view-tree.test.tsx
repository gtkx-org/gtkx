import type { ExpanderDescriptions, ListItem, ListItemRenderArgs } from "@gtkx/components";
import type { ReactNode } from "react";
import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { act, render, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import type { TreeFixture, TreeName } from "./helpers/trees.js";
import { expanderNamed, listRowByName } from "./helpers/expanders.js";
import { renderListView, renderStatefulListView } from "./helpers/list-fixtures.js";
import { expectRowTexts, rowTexts } from "./helpers/row-texts.js";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";
import { getSelectionModel, getTreeRow } from "./helpers/selection-model.js";
import { deepChain, mutuallyReferentialItems, selfReferentialItems, treeBranch, treeLeaf } from "./helpers/trees.js";

type WalkState = { expandedIds: string[]; ids: string[]; expanded: string[] };
type LazyChain = { items: ListItem<TreeName>[]; deepestRead: () => number };

const CHAIN_DEPTH = 8000;
const NOTHING: string[] = [];
const DEEP = ["a", "a0"];
const DEEP_AND_C = ["a", "a0", "c"];
const DEEP_AND_B = ["a", "a0", "b"];
const JUST_C = ["c"];
const UNREACHABLE = ["a0"];
const DESCRIPTIONS: ExpanderDescriptions = { expand: "Expand", collapse: "Collapse" };
const parentWithChildren = parent([treeLeaf("Child 1"), treeLeaf("Child 2")]);
const parentWithChild = parent([treeLeaf("Child")]);

const a11yItems: ListItem<TreeName>[] = [
    { id: "parent", value: { name: "Parent" }, children: [{ ...treeLeaf("child"), shouldHideExpander: true }] },
    { id: "quiet", value: { name: "Quiet" }, shouldHideExpander: true, children: [treeLeaf("kid")] },
    treeLeaf("leaf"),
];

const branchA = (): ListItem<TreeName> =>
    treeBranch("a", [treeBranch("a0", [treeLeaf("a00"), treeLeaf("a01")]), treeLeaf("a1")]);

const branchC = (): ListItem<TreeName> => treeBranch("c", [treeLeaf("c0")]);
const nestedTree = (): ListItem<TreeName>[] => [branchA(), treeLeaf("b"), branchC()];
const shuffledTree = (): ListItem<TreeName>[] => [treeLeaf("z"), branchA(), branchC()];

const grownTree = (): ListItem<TreeName>[] => [
    branchA(),
    treeBranch("b", [treeLeaf("b0"), treeLeaf("b1")]),
    branchC(),
];

const growingTree = (leading: ListItem<TreeName>[]): ListItem<TreeName>[] => [
    ...leading,
    treeBranch("a", [treeLeaf("a0")]),
    treeLeaf("z"),
];

function parent(children: ListItem<TreeName>[]): ListItem<TreeName>[] {
    return [{ id: "parent", value: { name: "Parent" }, children }];
}

function renderDepthAndState({ item, depth, isExpanded }: ListItemRenderArgs<TreeName>): ReactNode {
    return <GtkLabel>{`${item.name}:${String(depth)}:${String(isExpanded)}`}</GtkLabel>;
}

function renderName({ item }: ListItemRenderArgs<TreeName>): ReactNode {
    return <GtkLabel>{item.name}</GtkLabel>;
}

const lazyChain = (): LazyChain => {
    let deepestRead = -1;

    const chainNode = (level: number): ListItem<TreeName> => {
        let children: ListItem<TreeName>[] | undefined;

        return {
            ...treeLeaf(`n${String(level)}`),
            get children(): ListItem<TreeName>[] {
                deepestRead = Math.max(deepestRead, level);
                children ??= [chainNode(level + 1)];

                return children;
            },
        };
    };

    return { items: [chainNode(0)], deepestRead: () => deepestRead };
};

const setRowExpandedByName = async (name: string, isExpanded: boolean): Promise<void> => {
    const row = listRowByName(name);

    await act(() => {
        row.setExpanded(isExpanded);
    });
};

const walkLevel = (state: WalkState, level: ListItem<TreeName>[]): void => {
    for (const item of level) {
        const children = item.children ?? [];
        state.ids.push(item.id);

        if (children.length > 0 && state.expandedIds.includes(item.id)) {
            state.expanded.push(item.id);
            walkLevel(state, children);
        }
    }
};

const wantedWalk = (items: ListItem<TreeName>[], expandedIds: string[]): WalkState => {
    const state: WalkState = { expandedIds, ids: [], expanded: [] };
    walkLevel(state, items);

    return state;
};

const shownWalk = (fixture: TreeFixture): WalkState => {
    const state: WalkState = { expandedIds: [], ids: [], expanded: [] };
    const labels = rowTexts(fixture.ref.current);
    const model = getSelectionModel(fixture.ref);

    for (let position = 0; position < model.getNItems(); position++) {
        state.ids.push(labels[position] ?? "?");

        if (getTreeRow(model, position).getExpanded()) {
            state.expanded.push(labels[position] ?? "?");
        }
    }

    return state;
};

const expectAgreement = async (
    fixture: TreeFixture,
    items: ListItem<TreeName>[],
    expandedIds: string[],
): Promise<void> => {
    const wanted = wantedWalk(items, expandedIds);

    await waitFor(() => {
        const shown = shownWalk(fixture);
        expect(shown.ids).toEqual(wanted.ids);
        expect(shown.expanded).toEqual(wanted.expanded);
    });
};

const expectAgreementSteps = async (
    fixture: TreeFixture,
    tree: () => ListItem<TreeName>[],
    steps: string[][],
): Promise<void> => {
    for (const expandedIds of steps) {
        const items = tree();
        await fixture.rerender(items, { expandedIds });
        await expectAgreement(fixture, items, expandedIds);
    }
};

const renderAgreeing = async (tree: () => ListItem<TreeName>[], expandedIds: string[]): Promise<TreeFixture> => {
    const fixture = await renderListView<TreeName>(tree(), { expandedIds });
    await expectAgreement(fixture, tree(), expandedIds);

    return fixture;
};

const drawA11yTree = (expandedIds: string[], descriptions: ExpanderDescriptions | undefined): ReactNode => (
    <ScrollWrapper>
        <ListView
            items={a11yItems}
            renderItem={renderName}
            expandedIds={expandedIds}
            expanderDescriptions={descriptions}
        />
    </ScrollWrapper>
);

const expectNoDescription = (names: string[]): void => {
    for (const name of names) {
        expect(expanderNamed(name)).not.toHaveAccessibleDescription();
    }
};

describe("ListView tree expansion", () => {
    it("draws the children of the rows expandedIds names and follows the prop", async () => {
        const { ref, rerender } = await renderListView<TreeName>(parentWithChildren, { expandedIds: [] });
        expect(rowTexts(ref.current)).toEqual(["Parent"]);
        expect(listRowByName("Parent")).toHaveObjectProperty("expandable", true);
        await rerender(parentWithChildren, { expandedIds: ["parent"] });
        await expectRowTexts(ref, ["Parent", "Child 1", "Child 2"]);
        await rerender(parentWithChildren, { expandedIds: [] });
        await expectRowTexts(ref, ["Parent"]);
    });

    it("hands the renderer the depth and the expansion state of each row", async () => {
        const { ref } = await renderListView<TreeName>(parentWithChildren, {
            expandedIds: ["parent"],
            renderItem: renderDepthAndState,
        });

        await expectRowTexts(ref, ["Parent:0:true", "Child 1:1:undefined", "Child 2:1:undefined"]);
    });

    it("expands and collapses the row whose expander the user clicks and reports it", async () => {
        const onExpandedChange = vi.fn();
        const { ref } = await renderStatefulListView<TreeName>(parentWithChildren, { onExpandedChange });
        await userEvent.click(expanderNamed("Parent"));
        await expectRowTexts(ref, ["Parent", "Child 1", "Child 2"]);

        await waitFor(() => {
            expect(onExpandedChange).toHaveBeenCalledWith(["parent"]);
        });

        await userEvent.click(expanderNamed("Parent"));
        await expectRowTexts(ref, ["Parent"]);
    });

    it("draws every child again after repeated expand and collapse cycles", async () => {
        const { ref } = await renderStatefulListView<TreeName>(parentWithChildren, { estimatedItemHeight: 48 });

        for (let cycle = 0; cycle < 3; cycle++) {
            await setRowExpandedByName("Parent", true);
            await expectRowTexts(ref, ["Parent", "Child 1", "Child 2"]);
            await setRowExpandedByName("Parent", false);
            await expectRowTexts(ref, ["Parent"]);
        }
    });
});

describe("ListView tree drift", () => {
    it("re-asserts expandedIds after a row collapses itself", async () => {
        const items = parentWithChild;
        const { ref, rerender } = await renderListView<TreeName>(items, { expandedIds: ["parent"] });
        await expectRowTexts(ref, ["Parent", "Child"]);

        await act(() => {
            getTreeRow(getSelectionModel(ref), 0).setExpanded(false);
        });

        await rerender(items, { expandedIds: ["parent"] });
        await expectRowTexts(ref, ["Parent", "Child"]);
    });
});

describe("ListView tree order", () => {
    it("keeps the drawn rows in step with GTK as expansion changes", async () => {
        const fixture = await renderAgreeing(nestedTree, NOTHING);
        await expectAgreementSteps(fixture, nestedTree, [JUST_C, DEEP, DEEP_AND_C, NOTHING, DEEP_AND_C]);
    });

    it("keeps the drawn rows in step with GTK when an expanded id is unreachable", async () => {
        const fixture = await renderAgreeing(nestedTree, UNREACHABLE);
        await expectAgreementSteps(fixture, nestedTree, [DEEP]);
    });

    it("keeps the drawn rows in step with GTK as the structure changes", async () => {
        const fixture = await renderAgreeing(nestedTree, DEEP_AND_C);
        await expectAgreementSteps(fixture, shuffledTree, [DEEP_AND_C]);
        await expectAgreementSteps(fixture, nestedTree, [DEEP_AND_C]);
        await expectAgreementSteps(fixture, grownTree, [DEEP_AND_B]);
    });

    it("keeps the drawn rows in step with GTK after a row toggles itself", async () => {
        const fixture = await renderAgreeing(nestedTree, DEEP_AND_C);

        await act(() => {
            getTreeRow(getSelectionModel(fixture.ref), 0).setExpanded(false);
        });

        await expectAgreement(fixture, nestedTree(), DEEP_AND_C);
    });
});

describe("ListView tree structure changes", () => {
    it("shows the children a row gains and drops them again when they go away", async () => {
        const anchor = treeBranch("anchor", [treeLeaf("anchor child")]);
        const late = treeLeaf("late");
        const grown = treeBranch("late", [treeLeaf("late child")]);
        const options = { shouldExpandAll: true };
        const { ref, rerender } = await renderListView<TreeName>([anchor, late], options);
        await expectRowTexts(ref, ["anchor", "anchor child", "late"]);
        expect(listRowByName("late")).toHaveObjectProperty("expandable", false);
        await rerender([anchor, grown], options);
        await expectRowTexts(ref, ["anchor", "anchor child", "late", "late child"]);

        await waitFor(() => {
            expect(listRowByName("late")).toHaveObjectProperty("expandable", true);
        });

        await rerender([anchor, late], options);
        await expectRowTexts(ref, ["anchor", "anchor child", "late"]);
        await rerender([anchor, grown], options);
        await expectRowTexts(ref, ["anchor", "anchor child", "late", "late child"]);
    });

    it("keeps the surviving rows expanded when the list is filtered down", async () => {
        const options = { shouldExpandAll: true };
        const full = [treeBranch("a", [treeLeaf("a0")]), treeLeaf("b"), treeBranch("c", [treeLeaf("c0")])];
        const { ref, rerender } = await renderListView<TreeName>(full, options);
        await expectRowTexts(ref, ["a", "a0", "b", "c", "c0"]);
        await rerender([treeBranch("c", [treeLeaf("c0")])], options);
        await expectRowTexts(ref, ["c", "c0"]);
        await rerender(full, options);
        await expectRowTexts(ref, ["a", "a0", "b", "c", "c0"]);
    });

    it("keeps a row expanded when its siblings move around it", async () => {
        const { ref, rerender } = await renderStatefulListView<TreeName>(growingTree([]));

        await act(() => {
            getTreeRow(getSelectionModel(ref), 0).setExpanded(true);
        });

        await expectRowTexts(ref, ["a", "a0", "z"]);
        await rerender(growingTree([treeLeaf("y")]));
        await expectRowTexts(ref, ["y", "a", "a0", "z"]);
        await rerender([treeLeaf("z"), treeBranch("a", [treeLeaf("a0")]), treeLeaf("y")]);
        await expectRowTexts(ref, ["z", "a", "a0", "y"]);
    });
});

describe("ListView tree over unbounded sources", () => {
    it("draws one row for a chain deeper than the call stack and for cyclic items", async () => {
        const deep = await renderListView<TreeName>(deepChain(CHAIN_DEPTH), { expandedIds: [] });
        expect(rowTexts(deep.ref.current)).toEqual(["n0"]);
        const loop = await renderListView<TreeName>(selfReferentialItems(), { expandedIds: [] });
        expect(rowTexts(loop.ref.current)).toEqual(["loop"]);
        const mutual = await renderListView<TreeName>(mutuallyReferentialItems(), { expandedIds: [] });
        expect(rowTexts(mutual.ref.current)).toEqual(["a"]);
    });

    it("expands deep and cyclic sources one level at a time", async () => {
        const deep = await renderListView<TreeName>(deepChain(CHAIN_DEPTH), { expandedIds: ["n0"] });
        await expectRowTexts(deep.ref, ["n0", "n1"]);
        const loop = await renderListView<TreeName>(selfReferentialItems(), { expandedIds: ["loop"] });
        await expectRowTexts(loop.ref, ["loop", "loop"]);
        const mutual = await renderListView<TreeName>(mutuallyReferentialItems(), { expandedIds: ["a", "b"] });
        await expectRowTexts(mutual.ref, ["a", "b", "a"]);
    });

    it("reads only the levels it draws", async () => {
        const collapsed = lazyChain();
        const shallow = await renderListView<TreeName>(collapsed.items, { expandedIds: [] });
        await expectRowTexts(shallow.ref, ["n0"]);
        expect(collapsed.deepestRead()).toBe(1);
        const opened = lazyChain();
        const deeper = await renderListView<TreeName>(opened.items, { expandedIds: ["n0"] });
        await expectRowTexts(deeper.ref, ["n0", "n1"]);
        expect(opened.deepestRead()).toBe(2);
    });
});

describe("ListView tree expander accessibility", () => {
    it("names the expander after the row content and leaves the expanded state to GTK", async () => {
        await render(drawA11yTree(["parent"], DESCRIPTIONS));
        expect(expanderNamed("Parent")).toHaveAccessibleName("Parent");
        expect(expanderNamed("child")).toHaveAccessibleName("child");
        expect(expanderNamed("Parent")).toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, true);
        expect(expanderNamed("Quiet")).toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, false);
        expect(expanderNamed("leaf")).not.toHaveAccessibleState(Gtk.AccessibleState.EXPANDED);
    });

    it("describes what activating an expandable row's expander does", async () => {
        const { rerender } = await render(drawA11yTree([], DESCRIPTIONS));
        expect(expanderNamed("Parent")).toHaveAccessibleDescription("Expand");
        expect(expanderNamed("Quiet")).toHaveAccessibleDescription("Expand");
        expectNoDescription(["leaf"]);
        await rerender(drawA11yTree(["parent"], DESCRIPTIONS));
        expect(expanderNamed("Parent")).toHaveAccessibleDescription("Collapse");
    });

    it("drops the description when the wording is taken away", async () => {
        const { rerender } = await render(drawA11yTree(["parent"], DESCRIPTIONS));
        expect(expanderNamed("Parent")).toHaveAccessibleDescription("Collapse");
        await rerender(drawA11yTree(["parent"], undefined));
        expectNoDescription(["Parent", "Quiet", "child", "leaf"]);
    });
});
