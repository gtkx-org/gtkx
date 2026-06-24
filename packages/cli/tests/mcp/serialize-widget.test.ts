import { describe, expect, it } from "vitest";
import { serializeWidget, type WidgetFormatting } from "../../src/mcp/serialize-widget.js";
import { type FakeWidgetOverrides, makeFakeWidget } from "./_widget-helpers.js";

const ROLE_NAMES: Record<number, string> = { 1: "button", 2: "label" };

const testing: WidgetFormatting = {
    formatRole: (role) => ROLE_NAMES[role as number] ?? String(role),
    getWidgetNodeText: (widget) => {
        const probe = widget as { getLabel?: () => string | null; getText?: () => string | null };
        return probe.getLabel?.() ?? probe.getText?.() ?? null;
    },
};

const makeWidget = (overrides: FakeWidgetOverrides = {}): never => makeFakeWidget({ type: "GtkLabel", ...overrides });

let counter = 0;
const idFor = (): string => String(counter++);

describe("serializeWidget", () => {
    it("returns the wire shape with the registered id, lowercase role, and child trees", () => {
        counter = 0;
        const child = makeWidget({ type: "GtkButton", getAccessibleRole: () => 1, getLabel: () => "OK" });
        const root = makeWidget({
            type: "GtkBox",
            getAccessibleRole: () => 2,
            getName: () => "main",
            getCssClasses: () => ["primary"],
            getFirstChild: () => child,
        });

        const result = serializeWidget(root as never, idFor, testing);

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

    it("reads property text through the testing module", () => {
        const labelOnly = makeWidget({ getLabel: () => "L" });
        const textOnly = makeWidget({ getText: () => "T" });

        expect(serializeWidget(labelOnly as never, idFor, testing).text).toBe("L");
        expect(serializeWidget(textOnly as never, idFor, testing).text).toBe("T");
    });

    it("walks sibling chains via getNextSibling", () => {
        const sibling = makeWidget({ type: "GtkButton" });
        const firstChild = makeWidget({ type: "GtkLabel", getNextSibling: () => sibling });
        const root = makeWidget({ type: "GtkBox", getFirstChild: () => firstChild });

        const result = serializeWidget(root as never, idFor, testing);
        expect(result.children.map((node) => node.type)).toEqual(["GtkLabel", "GtkButton"]);
    });
});
