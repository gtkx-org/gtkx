import "@gtkx/jsx/adw";
import { ELEMENTS, type ElementBehavior } from "@gtkx/react/config";
import { describe, expect, it } from "vitest";

const behaviorsFor = (type: string): ElementBehavior[] => ELEMENTS[type]?.behaviors ?? [];

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
        for (const [type, config] of Object.entries(ELEMENTS)) {
            (config.behaviors ?? []).forEach((behavior, index) => {
                if (Object.keys(behavior).length === 0) empty.push(`${type}[${index}]`);
            });
        }
        expect(empty.sort()).toEqual([]);
    });
});
