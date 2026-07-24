import "@gtkx/jsx/adw";
import { ELEMENT_RULES } from "@gtkx/react/element-rules";
import { describe, expect, it } from "vitest";

const containerFor = (type: string, prop: string) =>
    (ELEMENT_RULES[type] ?? []).find((rule) => rule.kind === "container" && rule.prop === prop);

describe("adwaita rule registration", () => {
    it("registers Adwaita rules when @gtkx/jsx/adw is loaded", () => {
        expect(containerFor("AdwBin", "children")).toMatchObject({ child: "GtkWidget" });
        expect(containerFor("AdwToolbarView", "children")).toMatchObject({ child: "GtkWidget" });
        expect(containerFor("AdwNavigationSplitView", "children")).toMatchObject({ child: "AdwNavigationPage" });
        expect(containerFor("AdwPreferencesPage", "children")).toMatchObject({ child: "AdwPreferencesGroup" });
        expect(containerFor("AdwTabView", "children")).toMatchObject({ child: "GtkWidget" });
        expect(containerFor("AdwLeaflet", "children")).toMatchObject({ child: "GtkWidget" });
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
