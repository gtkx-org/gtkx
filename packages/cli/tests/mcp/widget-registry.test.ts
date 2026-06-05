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

describe("WidgetRegistry.refresh", () => {
    it("clears the reverse lookup and re-registers from the live toplevels", () => {
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
});

describe("WidgetRegistry.serialize", () => {
    it("returns the wire shape with the registered id, role name, and child trees", () => {
        const child = makeWidget({ type: "GtkButton", getLabel: () => "OK" });
        const root = makeWidget({
            type: "GtkBox",
            getAccessibleRole: () => 2,
            getName: () => "main",
            getCssClasses: () => ["primary"],
            getFirstChild: () => child,
        });

        const registry = new WidgetRegistry();
        const result = registry.serialize(root as never);

        expect(result.type).toBe("GtkBox");
        expect(result.role).toBe("LABEL");
        expect(result.name).toBe("main");
        expect(result.cssClasses).toEqual(["primary"]);
        expect(result.children).toHaveLength(1);
        const [serializedChild] = result.children;
        expect(serializedChild?.type).toBe("GtkButton");
        expect(serializedChild?.text).toBe("OK");
    });

    it("falls back through getLabel, getText, getTitle in order when extracting text", () => {
        const registry = new WidgetRegistry();
        const labelOnly = makeWidget({ getLabel: () => "L" });
        const textOnly = makeWidget({ getText: () => "T" });
        const titleOnly = makeWidget({ getTitle: () => "Ti" });

        expect(registry.serialize(labelOnly as never).text).toBe("L");
        expect(registry.serialize(textOnly as never).text).toBe("T");
        expect(registry.serialize(titleOnly as never).text).toBe("Ti");
    });

    it("formats unknown role values as their numeric string", () => {
        const registry = new WidgetRegistry();
        const widget = makeWidget({ getAccessibleRole: () => 99 });

        expect(registry.serialize(widget as never).role).toBe("99");
    });

    it("returns UNKNOWN when the role is undefined", () => {
        const registry = new WidgetRegistry();
        const widget = makeWidget({ getAccessibleRole: () => undefined });

        expect(registry.serialize(widget as never).role).toBe("UNKNOWN");
    });
});
