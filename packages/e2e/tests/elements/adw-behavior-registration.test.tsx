import "@gtkx/jsx/adw";
import { behaviorFor, listBehaviorFor } from "@gtkx/react/element-rules";
import { describe, expect, it } from "vitest";

describe("adwaita behavior registration", () => {
    it("registers container behaviors when @gtkx/react/adw is loaded", () => {
        expect(behaviorFor("AdwBin", "children", "GtkWidget")).toBeDefined();
        expect(behaviorFor("AdwToolbarView", "children", "GtkWidget")).toBeDefined();
        expect(behaviorFor("AdwNavigationSplitView", "children", "AdwNavigationPage")).toBeDefined();
        expect(behaviorFor("AdwPreferencesPage", "children", "AdwPreferencesGroup")).toBeDefined();
        expect(behaviorFor("AdwTabView", "children", "GtkWidget")).toBeDefined();
        expect(behaviorFor("AdwCarousel", "children", "GtkWidget")).toBeDefined();
        expect(behaviorFor("AdwLeaflet", "children", "GtkWidget")).toBeDefined();
    });

    it("registers the alert dialog response list behavior", () => {
        expect(listBehaviorFor("AdwAlertDialog", "responses")).toBeDefined();
    });
});
