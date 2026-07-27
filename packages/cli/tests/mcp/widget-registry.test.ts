import { describe, expect, it, vi } from "vitest";
import { WidgetRegistry } from "../../src/mcp/widget-registry.js";
import { type FakeWidgetOverrides, makeFakeWidget } from "./fake-widget.js";

const { listToplevels } = vi.hoisted(() => ({
    listToplevels: vi.fn(() => [] as unknown[]),
}));

const makeWidget = (overrides: FakeWidgetOverrides = {}): never => makeFakeWidget({ type: "GtkLabel", ...overrides });

vi.mock("@gtkx/gi/gtk", () => ({
    AccessibleRole: { BUTTON: 1, LABEL: 2 } as Record<string, number>,
    Window: { listToplevels },
}));

describe("WidgetRegistry.getOrCreateId", () => {
    it("assigns stable, distinct ids to distinct widgets", () => {
        const registry = new WidgetRegistry();
        const a = makeWidget();
        const b = makeWidget();
        const idA = registry.getOrCreateId(a);
        const idB = registry.getOrCreateId(b);
        expect(idA).not.toBe(idB);
        expect(registry.getOrCreateId(a)).toBe(idA);
    });
});

describe("WidgetRegistry.register / get", () => {
    it("walks descendants and stores them in the reverse lookup map", () => {
        const registry = new WidgetRegistry();
        const grandchild = makeWidget();
        const child = makeWidget({ getFirstChild: () => grandchild });
        const root = makeWidget({ getFirstChild: () => child });
        registry.register(root);
        const rootId = registry.getOrCreateId(root);
        const childId = registry.getOrCreateId(child);
        const grandId = registry.getOrCreateId(grandchild);
        expect(registry.get(rootId)).toBe(root);
        expect(registry.get(childId)).toBe(child);
        expect(registry.get(grandId)).toBe(grandchild);
    });

    it("walks sibling chains via getNextSibling", () => {
        const registry = new WidgetRegistry();
        const sibling = makeWidget();
        const firstChild = makeWidget({ getNextSibling: () => sibling });
        const root = makeWidget({ getFirstChild: () => firstChild });
        registry.register(root);
        expect(registry.get(registry.getOrCreateId(sibling))).toBe(sibling);
    });
});

describe("WidgetRegistry.refresh / windows", () => {
    it("clears the reverse lookup and re-registers from the live windows", () => {
        const stale = makeWidget();
        const fresh = makeWidget();
        const registry = new WidgetRegistry();
        registry.register(stale);
        const staleId = registry.getOrCreateId(stale);
        listToplevels.mockReturnValueOnce([fresh]);
        registry.refresh();
        expect(registry.get(staleId)).toBeUndefined();
        expect(registry.get(registry.getOrCreateId(fresh))).toBe(fresh);
    });

    it("retains the toplevel set captured by the most recent refresh", () => {
        const first = makeWidget();
        const second = makeWidget();
        const registry = new WidgetRegistry();
        expect(registry.toplevels()).toEqual([]);
        listToplevels.mockReturnValueOnce([first, second]);
        registry.refresh();
        expect(registry.toplevels()).toEqual([first, second]);
    });
});
