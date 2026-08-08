import { describe, expect, it } from "vitest";
import { serializeWidget, type WidgetFormatting } from "../../src/mcp/serialize-widget.js";
import { type FakeWidgetOverrides, makeFakeWidget } from "./fake-widget.js";

const ROLE_NAMES: Record<number, string> = { 1: "button", 2: "label" };

const testing: WidgetFormatting = {
    formatRole: (role) => ROLE_NAMES[role] ?? String(role),
    getWidgetText: (widget) => {
        const probe = widget as { getLabel?: () => string | null; getText?: () => string | null };

        return probe.getLabel?.() ?? probe.getText?.() ?? null;
    },
};

const nextId = createNextId();

const makeWidget = (overrides: FakeWidgetOverrides = {}): never => makeFakeWidget({ type: "GtkLabel", ...overrides });

function createNextId(): () => string {
    let counter = 0;

    return () => String(counter++);
}

describe("serializeWidget", () => {
    it("returns the wire shape with the registered id, lowercase role, and child trees", () => {
        const child = makeWidget({ type: "GtkButton", getAccessibleRole: () => 1, getLabel: () => "OK" });

        const root = makeWidget({
            type: "GtkBox",
            getAccessibleRole: () => 2,
            getName: () => "main",
            getCssClasses: () => ["primary"],
            getFirstChild: () => child,
        });

        const result = serializeWidget(root, nextId, testing);
        expect(result.type).toBe("GtkBox");
        expect(result.role).toBe("label");
        expect(result.name).toBe("main");
        expect(result.cssClasses).toEqual(["primary"]);
        expect(result.children).toHaveLength(1);
        const [serializedChild] = result.children;
        expect(serializedChild?.type).toBe("GtkButton");
        expect(serializedChild?.role).toBe("button");
        expect(serializedChild?.text).toBe("OK");
        expect(result.id).not.toBe(serializedChild?.id);
    });

    it("stops descending at maxDepth", () => {
        const child = makeWidget({ type: "GtkButton", getAccessibleRole: () => 1 });
        const root = makeWidget({ type: "GtkBox", getFirstChild: () => child });
        expect(serializeWidget(root, nextId, testing, 0).children).toEqual([]);
        expect(serializeWidget(root, nextId, testing, 1).children).toHaveLength(1);
    });

    it("reads property text through the testing module", () => {
        const labelOnly = makeWidget({ getLabel: () => "L" });
        const textOnly = makeWidget({ getText: () => "T" });
        expect(serializeWidget(labelOnly, nextId, testing).text).toBe("L");
        expect(serializeWidget(textOnly, nextId, testing).text).toBe("T");
    });

    it("walks sibling chains via getNextSibling", () => {
        const sibling = makeWidget({ type: "GtkButton" });
        const firstChild = makeWidget({ type: "GtkLabel", getNextSibling: () => sibling });
        const root = makeWidget({ type: "GtkBox", getFirstChild: () => firstChild });
        const result = serializeWidget(root, nextId, testing);
        expect(result.children.map((node) => node.type)).toEqual(["GtkLabel", "GtkButton"]);
    });
});
