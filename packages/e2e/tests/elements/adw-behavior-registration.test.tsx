import "@gtkx/jsx/adw";
import { type ElementBehavior, ELEMENTS } from "@gtkx/react/config";
import { describe, expect, it } from "vitest";

const behaviorsFor = (type: string): ElementBehavior[] => ELEMENTS[type]?.behaviors ?? [];

const emptyBehaviorNames = (type: string, behaviors: ElementBehavior[]): string[] =>
    behaviors.flatMap((behavior, index) => (Object.keys(behavior).length === 0 ? [`${type}[${String(index)}]`] : []));

describe("adwaita behavior registration", () => {
    it("registers Adwaita behaviors when @gtkx/jsx/adw is loaded", () => {
        expect(behaviorsFor("AdwBin").length).toBeGreaterThan(0);
        expect(behaviorsFor("AdwToolbarView").length).toBeGreaterThan(0);
        expect(behaviorsFor("AdwNavigationSplitView").length).toBeGreaterThan(0);
        expect(behaviorsFor("AdwPreferencesPage").length).toBeGreaterThan(0);
        expect(behaviorsFor("AdwTabView").length).toBeGreaterThan(0);
        expect(behaviorsFor("AdwWrapBox").length).toBeGreaterThan(0);
    });

    it("gives every registered behavior at least one property", () => {
        const empty = Object.entries(ELEMENTS).flatMap(([type, config]) =>
            emptyBehaviorNames(type, config.behaviors ?? []),
        );

        expect(empty.toSorted((left, right) => left.localeCompare(right))).toEqual([]);
    });
});
