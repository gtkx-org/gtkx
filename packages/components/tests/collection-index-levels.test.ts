import type { ListItem } from "@gtkx/components";
import { describe, expect, it } from "vitest";
import type { CollectionIndex, Level } from "../src/internal/collection-index.js";
import { createCollectionIndex, emptyLevel } from "../src/internal/collection-index.js";
import { treeBranch, treeLeaf } from "./helpers/tree-fixtures.js";

const branchOver = (childId: string): ListItem[] => [treeBranch("p", [treeLeaf(childId)])];
const getGroup = (index: CollectionIndex): Level => index.groups.at(0) ?? emptyLevel();
const getIds = (level: Level | undefined): string[] => (level?.items ?? []).map((item) => item.id);

describe("createCollectionIndex - resolving a child level", () => {
    it("reads the slot's children through the parent level", () => {
        const index = createCollectionIndex(branchOver("child"), undefined, false);
        const child = index.childLevel(getGroup(index), 0);
        expect(getIds(child)).toEqual(["child"]);
    });

    it("reads the current children when handed a level built by an earlier index", () => {
        const previous = createCollectionIndex(branchOver("old"), undefined, false);
        const next = createCollectionIndex(branchOver("new"), undefined, false);
        const child = next.childLevel(getGroup(previous), 0);
        expect(getIds(child)).toEqual(["new"]);
        expect(getIds(next.levelFor(child?.path ?? ""))).toEqual(["new"]);
    });

    it("has no child level for a slot without children", () => {
        const index = createCollectionIndex([treeBranch("p", [treeLeaf("c")]), treeLeaf("q")], undefined, false);
        expect(index.childLevel(getGroup(index), 1)).toBeUndefined();
    });
});
