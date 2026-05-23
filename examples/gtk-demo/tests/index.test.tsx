import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";

describe("application entry-point", () => {
    it("creates the gtk-demo GtkApplication and attaches a main window", async () => {
        await import("../src/index.js");
        const demoApp = Gtk.Application.getDefault();
        expect(demoApp).toBeInstanceOf(Gtk.Application);
        expect(demoApp?.getApplicationId()).toBe("org.gtkx.gtk-demo");
    });
});
