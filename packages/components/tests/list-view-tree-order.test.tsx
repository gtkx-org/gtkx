import type { ListItem } from "@gtkx/components";
import type * as Gtk from "@gtkx/gi/gtk";
import { act, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import type { TreeFixture, TreeName } from "./helpers/tree-fixtures.js";
import { renderListView } from "./helpers/list-fixtures.js";
import { rowTexts } from "./helpers/row-texts.js";
import { getSelectionModel, getTreeRow } from "./helpers/selection-model.js";
import { treeBranch, treeLeaf } from "./helpers/tree-fixtures.js";

type WalkState = {
    expandedIds: string[];
    ids: string[];
    expanded: string[];
};

const NOTHING: string[] = [];
const DEEP = ["a", "a0"];
const DEEP_AND_C = ["a", "a0", "c"];
const DEEP_AND_B = ["a", "a0", "b"];
const JUST_C = ["c"];
const UNREACHABLE = ["a0"];

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

const readRow = (state: WalkState, labels: (string | null)[], model: Gtk.SelectionModel, position: number): void => {
    const id = labels[position] ?? "?";
    state.ids.push(id);

    if (getTreeRow(model, position).getExpanded()) {
        state.expanded.push(id);
    }
};

const shownWalk = (fixture: TreeFixture): WalkState => {
    const state: WalkState = { expandedIds: [], ids: [], expanded: [] };
    const labels = rowTexts(fixture.ref.current);
    const model = getSelectionModel(fixture.ref);

    for (let position = 0; position < model.getNItems(); position++) {
        readRow(state, labels, model, position);
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

const expectShownAgreement = async (
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

const expectRenderedAgreement = async (
    tree: () => ListItem<TreeName>[],
    expandedIds: string[],
): Promise<TreeFixture> => {
    const fixture = await renderListView<TreeName>(tree(), { expandedIds });
    await expectAgreement(fixture, tree(), expandedIds);

    return fixture;
};

describe("render - ListView (tree) - the derived order agrees with GTK across expansion changes", () => {
    it("agrees while expansion is added and removed level by level", async () => {
        const fixture = await expectRenderedAgreement(nestedTree, NOTHING);
        await expectShownAgreement(fixture, nestedTree, [JUST_C, DEEP, DEEP_AND_C, NOTHING, DEEP_AND_C]);
    });

    it("agrees after a collapse discards the nested expansion GTK forgets", async () => {
        const fixture = await expectRenderedAgreement(nestedTree, DEEP);
        await expectShownAgreement(fixture, nestedTree, [JUST_C, DEEP]);
    });

    it("agrees when an expanded id is unreachable because its parent stays collapsed", async () => {
        const fixture = await expectRenderedAgreement(nestedTree, UNREACHABLE);
        await expectShownAgreement(fixture, nestedTree, [DEEP]);
    });
});

describe("render - ListView (tree) - the derived order agrees with GTK across structure changes", () => {
    it("agrees after rows are inserted before and removed after an expanded row", async () => {
        const fixture = await expectRenderedAgreement(nestedTree, DEEP_AND_C);
        await expectShownAgreement(fixture, shuffledTree, [DEEP_AND_C]);
        await expectShownAgreement(fixture, nestedTree, [DEEP_AND_C]);
    });

    it("agrees after a leaf grows children and becomes expandable", async () => {
        const fixture = await expectRenderedAgreement(nestedTree, DEEP_AND_B);
        await expectShownAgreement(fixture, grownTree, [DEEP_AND_B]);
        await expectShownAgreement(fixture, nestedTree, [DEEP_AND_B]);
    });
});

describe("render - ListView (tree) - the derived order agrees with GTK after out-of-band drift", () => {
    it("agrees after a row collapses itself out of band", async () => {
        const fixture = await expectRenderedAgreement(nestedTree, DEEP_AND_C);

        await act(() => {
            getTreeRow(getSelectionModel(fixture.ref), 0).setExpanded(false);
        });

        await expectAgreement(fixture, nestedTree(), DEEP_AND_C);
    });

    it("agrees after a row expands itself out of band", async () => {
        const fixture = await expectRenderedAgreement(nestedTree, JUST_C);

        await act(() => {
            getTreeRow(getSelectionModel(fixture.ref), 0).setExpanded(true);
        });

        await expectAgreement(fixture, nestedTree(), JUST_C);
    });
});
