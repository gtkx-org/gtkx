import { describe, expect, it } from "vitest";
import * as Gtk from "../src/generated/gtk/index.js";
import { getCurrentApp, start } from "../src/index.js";

describe("start", () => {
    it("returns a GTK Application instance", () => {
        const app = getCurrentApp();
        expect(app).toBeInstanceOf(Gtk.Application);
    });

    it("returns the same instance on subsequent calls", () => {
        const app1 = start("com.gtkx.test.ffi");
        const app2 = start("com.gtkx.test.ffi");
        expect(app1).toBe(app2);
    });
});
