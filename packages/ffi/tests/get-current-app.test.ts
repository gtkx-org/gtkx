import { describe, expect, it } from "vitest";
import * as Gtk from "../src/generated/gtk/index.js";
import { getCurrentApp } from "../src/index.js";

describe("getCurrentApp", () => {
    it("returns the running GTK Application", () => {
        const app = getCurrentApp();
        expect(app).toBeDefined();
        expect(app).toBeInstanceOf(Gtk.Application);
    });
});
