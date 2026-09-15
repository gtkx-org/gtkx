import type { ExpanderDescriptions, ListItem, ListItemRenderArgs } from "@gtkx/components";
import type { ReactNode } from "react";
import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { act, render, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import type { TreeName } from "./helpers/trees.js";
import { expanderCount, expanderNamed, listRowByName } from "./helpers/expanders.js";
import { renderListView, renderStatefulListView } from "./helpers/list-fixtures.js";
import { expectRowTexts, rowTexts } from "./helpers/row-texts.js";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";
import { getSelectionModel, getTreeRow } from "./helpers/selection-model.js";
import { treeBranch, treeLeaf } from "./helpers/trees.js";

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

const setRowExpandedByName = async (name: string, isExpanded: boolean): Promise<void> => {
    const row = listRowByName(name);

    await act(() => {
        row.setExpanded(isExpanded);
    });
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

    it("draws exactly one expander on each row of a single-column tree", async () => {
        const { ref } = await renderListView<TreeName>(parentWithChildren, { expandedIds: ["parent"] });
        await expectRowTexts(ref, ["Parent", "Child 1", "Child 2"]);
        expect(expanderCount()).toBe(3);
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
    it("expands nested branches and drops descendants when their parent collapses", async () => {
        const { ref, rerender } = await renderListView<TreeName>(nestedTree(), { expandedIds: [] });
        await expectRowTexts(ref, ["a", "b", "c"]);
        await rerender(nestedTree(), { expandedIds: ["a", "a0", "c"] });
        await expectRowTexts(ref, ["a", "a0", "a00", "a01", "a1", "b", "c", "c0"]);
        await rerender(nestedTree(), { expandedIds: ["a0", "c"] });
        await expectRowTexts(ref, ["a", "b", "c", "c0"]);
        await rerender(nestedTree(), { expandedIds: ["a", "a0"] });
        await expectRowTexts(ref, ["a", "a0", "a00", "a01", "a1", "b", "c"]);
    });

    it("keeps expanded descendants attached to their parent as siblings change", async () => {
        const expandedIds = ["a", "a0", "c"];
        const { ref, rerender } = await renderListView<TreeName>(nestedTree(), { expandedIds });
        await expectRowTexts(ref, ["a", "a0", "a00", "a01", "a1", "b", "c", "c0"]);
        await rerender(shuffledTree(), { expandedIds });
        await expectRowTexts(ref, ["z", "a", "a0", "a00", "a01", "a1", "c", "c0"]);
        await rerender(grownTree(), { expandedIds: ["a", "a0", "b"] });
        await expectRowTexts(ref, ["a", "a0", "a00", "a01", "a1", "b", "b0", "b1", "c"]);
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
