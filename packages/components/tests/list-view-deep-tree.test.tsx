import type { ListItem } from "@gtkx/components";
import { describe, expect, it } from "vitest";
import type { TreeName } from "./helpers/tree-fixtures.js";
import { deepChain, mutuallyReferentialItems, selfReferentialItems } from "./helpers/deep-trees.js";
import { renderListView } from "./helpers/list-fixtures.js";
import { expectRowTexts, rowTexts } from "./helpers/row-texts.js";
import { treeLeaf } from "./helpers/tree-fixtures.js";

type LazyChain = {
    items: ListItem<TreeName>[];
    deepestRead: () => number;
};

const CHAIN_DEPTH = 8000;

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

const expectLazyReads = async (expandedIds: string[], rows: string[], deepest: number): Promise<void> => {
    const chain = lazyChain();
    const { ref } = await renderListView<TreeName>(chain.items, { expandedIds });
    await expectRowTexts(ref, rows);
    expect(chain.deepestRead()).toBe(deepest);
};

describe("render - ListView (tree) - collapsed deep and cyclic sources", () => {
    it("draws one row for a chain deeper than the call stack", async () => {
        const { ref } = await renderListView<TreeName>(deepChain(CHAIN_DEPTH), { expandedIds: [] });
        expect(rowTexts(ref.current)).toEqual(["n0"]);
    });

    it("draws one row for an item that is its own child", async () => {
        const { ref } = await renderListView<TreeName>(selfReferentialItems(), { expandedIds: [] });
        expect(rowTexts(ref.current)).toEqual(["loop"]);
    });

    it("draws one row for two items that reference each other", async () => {
        const { ref } = await renderListView<TreeName>(mutuallyReferentialItems(), { expandedIds: [] });
        expect(rowTexts(ref.current)).toEqual(["a"]);
    });

    it("reads only the drawn levels of an unbounded source", async () => {
        await expectLazyReads([], ["n0"], 1);
    });

    it("reads only the drawn levels of an unbounded source with an expanded head", async () => {
        await expectLazyReads(["n0"], ["n0", "n1"], 2);
    });
});

describe("render - ListView (tree) - expanded deep and cyclic sources", () => {
    it("expands the head of a deep chain without drawing the whole chain", async () => {
        const { ref } = await renderListView<TreeName>(deepChain(CHAIN_DEPTH), { expandedIds: ["n0"] });
        await expectRowTexts(ref, ["n0", "n1"]);
    });

    it("expands a cyclic item one level at a time", async () => {
        const { ref } = await renderListView<TreeName>(selfReferentialItems(), { expandedIds: ["loop"] });
        await expectRowTexts(ref, ["loop", "loop"]);
    });

    it("expands two items that reference each other one level at a time", async () => {
        const { ref } = await renderListView<TreeName>(mutuallyReferentialItems(), { expandedIds: ["a", "b"] });
        await expectRowTexts(ref, ["a", "b", "a"]);
    });
});
