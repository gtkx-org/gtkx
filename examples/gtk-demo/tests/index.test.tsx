import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { act } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

describe("application entry-point", () => {
    it("creates the gtk-demo AdwApplication and attaches a main window", async () => {
        await act(async () => {
            await import("../src/index.js");
        });

        const demoApp = Gtk.Application.getDefault();
        expect(demoApp).toBeInstanceOf(Adw.Application);
        expect(demoApp?.getApplicationId()).toBe("org.gtkx.gtk-demo");
    });
});
