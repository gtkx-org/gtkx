import "@gtkx/jsx/adw";
import { type ContainerRule, ELEMENT_RULES } from "@gtkx/react/element-rules";
import { describe, expect, it } from "vitest";

const containerFor = (type: string, prop: string): ContainerRule | undefined =>
    (ELEMENT_RULES[type] ?? []).find((rule): rule is ContainerRule => rule.kind === "container" && rule.prop === prop);

describe("adwaita rule registration", () => {
    it("registers Adwaita rules when @gtkx/jsx/adw is loaded", () => {
        expect(containerFor("AdwBin", "children")?.child).toBe("GtkWidget");
        expect(containerFor("AdwToolbarView", "children")?.child).toBe("GtkWidget");
        expect(containerFor("AdwNavigationSplitView", "children")?.child).toBe("AdwNavigationPage");
        expect(containerFor("AdwPreferencesPage", "children")?.child).toBe("AdwPreferencesGroup");
        expect(containerFor("AdwTabView", "children")?.child).toBe("GtkWidget");
        expect(containerFor("AdwLeaflet", "children")?.child).toBe("GtkWidget");
    });

    it("gives every registered rule a behavior", () => {
        const missing: string[] = [];
        for (const [type, rules] of Object.entries(ELEMENT_RULES)) {
            for (const rule of rules) {
                if (rule.kind === "container" && Object.keys(rule.behavior).length === 0) {
                    missing.push(`${type}.${rule.prop}`);
                }
                if (rule.kind === "list" && Object.keys(rule.behavior).length === 0) {
                    missing.push(`${type}.${rule.prop}`);
                }
            }
        }
        expect(missing.sort()).toEqual([]);
    });
});
