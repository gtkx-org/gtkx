import type { ListItem } from "@gtkx/components";
import { bench, describe } from "vitest";
import type { CollectionIndex } from "../src/internal/collection-index.js";
import type { CollectionModel } from "../src/internal/collection-model.js";
import type { VisibleOrder } from "../src/internal/tree-order.js";
import { createCollectionIndex } from "../src/internal/collection-index.js";
import { createCollectionModel } from "../src/internal/collection-model.js";
import { trackPaths } from "../src/internal/slots.js";
import { adoptOrder } from "../src/internal/tree-expansion.js";
import { buildVisibleOrder } from "../src/internal/tree-order.js";
import { expandablePaths } from "../tests/helpers/expandable-paths.js";

type NarrowingCase = {
    model: CollectionModel;
    wide: CollectionIndex;
    narrow: CollectionIndex;
    order: VisibleOrder;
};

const BRANCH_COUNT = 2500;
const HANDFUL_COUNT = 5;
const HALF_COUNT = 1250;
const cases: Map<string, NarrowingCase> = new Map();

const leaf = (id: string): ListItem => ({ id, value: { name: id } });
const branch = (id: string): ListItem => ({ id, value: { name: id }, children: [leaf(`${id}-child`)] });
const treeIndex = (items: ListItem[]): CollectionIndex => createCollectionIndex(items, undefined, false);
const branches = (count: number): ListItem[] => Array.from({ length: count }, (_, i) => branch(`b-${String(i)}`));
const leaves = (count: number): ListItem[] => Array.from({ length: count }, (_, i) => leaf(`l-${String(i)}`));

function newNarrowingCase(narrowed: ListItem[]): NarrowingCase {
    const wide = treeIndex(branches(BRANCH_COUNT));
    const model = createCollectionModel();
    model.sync(wide);
    const order = buildVisibleOrder(wide, trackPaths(expandablePaths(wide)));
    adoptOrder(model.expansion, order);

    return { model, wide, narrow: treeIndex(narrowed), order };
}

function caseFor(name: string, narrowed: () => ListItem[]): NarrowingCase {
    const existing = cases.get(name);

    if (existing !== undefined) {
        return existing;
    }

    const created = newNarrowingCase(narrowed());
    cases.set(name, created);

    return created;
}

function runCycle(narrowing: NarrowingCase): void {
    narrowing.model.sync(narrowing.narrow);
    narrowing.model.sync(narrowing.wide);
    adoptOrder(narrowing.model.expansion, narrowing.order);
}

describe("tree narrowing", () => {
    bench("narrow 5000 expanded rows to a handful and restore", () => {
        runCycle(caseFor("handful", () => branches(HANDFUL_COUNT)));
    });

    bench("narrow 5000 expanded rows by half, flipping expandability, and restore", () => {
        runCycle(caseFor("half", () => [branch("b-0"), ...leaves(HALF_COUNT - 1)]));
    });
});
