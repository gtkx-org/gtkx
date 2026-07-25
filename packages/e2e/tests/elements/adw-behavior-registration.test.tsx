import "@gtkx/jsx/adw";
import { ELEMENT_BEHAVIORS, type ElementBehavior } from "@gtkx/react/elements";
import { describe, expect, it } from "vitest";

const behaviorsFor = (type: string): ElementBehavior[] => ELEMENT_BEHAVIORS[type] ?? [];

describe("adwaita behavior registration", () => {
    it("registers Adwaita behaviors when @gtkx/jsx/adw is loaded", () => {
        expect(behaviorsFor("AdwBin").length).toBeGreaterThan(0);
        expect(behaviorsFor("AdwToolbarView").length).toBeGreaterThan(0);
        expect(behaviorsFor("AdwNavigationSplitView").length).toBeGreaterThan(0);
        expect(behaviorsFor("AdwPreferencesPage").length).toBeGreaterThan(0);
        expect(behaviorsFor("AdwTabView").length).toBeGreaterThan(0);
        expect(behaviorsFor("AdwLeaflet").length).toBeGreaterThan(0);
    });

    it("gives every registered behavior at least one property", () => {
        const empty: string[] = [];
        for (const [type, behaviors] of Object.entries(ELEMENT_BEHAVIORS)) {
            behaviors.forEach((behavior, index) => {
                if (Object.keys(behavior).length === 0) empty.push(`${type}[${index}]`);
            });
        }
        expect(empty.sort()).toEqual([]);
    });
});
