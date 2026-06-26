import { describe, expect, it, vi } from "vitest";

const { listToplevels } = vi.hoisted(() => ({
    listToplevels: vi.fn(() => [] as unknown[]),
}));

vi.mock("@gtkx/gi/gtk", () => ({
    AccessibleRole: { BUTTON: 1, LABEL: 2 } as Record<string, number>,
    Window: { listToplevels },
}));

import { WidgetRegistry } from "../../src/mcp/widget-registry.js";
import { type FakeWidgetOverrides, makeFakeWidget } from "./_widget-helpers.js";

const makeWidget = (overrides: FakeWidgetOverrides = {}): never => makeFakeWidget({ type: "GtkLabel", ...overrides });

describe("WidgetRegistry.idFor", () => {
    it("assigns stable, distinct ids to distinct widgets", () => {
        const registry = new WidgetRegistry();
        const a = makeWidget();
        const b = makeWidget();

        const idA = registry.idFor(a as never);
        const idB = registry.idFor(b as never);

        expect(idA).not.toBe(idB);
        expect(registry.idFor(a as never)).toBe(idA);
    });
});

describe("WidgetRegistry.register / get", () => {
    it("walks descendants and stores them in the reverse lookup map", () => {
        const registry = new WidgetRegistry();
        const grandchild = makeWidget();
        const child = makeWidget({ getFirstChild: () => grandchild });
        const root = makeWidget({ getFirstChild: () => child });

        registry.register(root as never);

        const rootId = registry.idFor(root as never);
        const childId = registry.idFor(child as never);
        const grandId = registry.idFor(grandchild as never);

        expect(registry.get(rootId)).toBe(root);
        expect(registry.get(childId)).toBe(child);
        expect(registry.get(grandId)).toBe(grandchild);
    });

    it("walks sibling chains via getNextSibling", () => {
        const registry = new WidgetRegistry();
        const sibling = makeWidget();
        const firstChild = makeWidget({ getNextSibling: () => sibling });
        const root = makeWidget({ getFirstChild: () => firstChild });

        registry.register(root as never);

        expect(registry.get(registry.idFor(sibling as never))).toBe(sibling);
    });
});

describe("WidgetRegistry.refresh / windows", () => {
    it("clears the reverse lookup and re-registers from the live windows", () => {
        const stale = makeWidget();
        const fresh = makeWidget();
        const registry = new WidgetRegistry();
        registry.register(stale as never);
        const staleId = registry.idFor(stale as never);

        listToplevels.mockReturnValueOnce([fresh as unknown]);
        registry.refresh();

        expect(registry.get(staleId)).toBeUndefined();
        expect(registry.get(registry.idFor(fresh as never))).toBe(fresh);
    });

    it("retains the toplevel set captured by the most recent refresh", () => {
        const first = makeWidget();
        const second = makeWidget();
        const registry = new WidgetRegistry();

        expect(registry.toplevels()).toEqual([]);

        listToplevels.mockReturnValueOnce([first as unknown, second as unknown]);
        registry.refresh();

        expect(registry.toplevels()).toEqual([first, second]);
    });
});
