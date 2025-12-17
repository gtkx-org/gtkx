import { describe, expect, it } from "vitest";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("constants", () => {
    it("exports string constant", () => {
        expect(typeof Gtk.ACCESSIBLE_ATTRIBUTE_BACKGROUND).toBe("string");
        expect(Gtk.ACCESSIBLE_ATTRIBUTE_BACKGROUND).toBe("bg-color");
    });

    it("exports multiple string constants", () => {
        expect(Gtk.ACCESSIBLE_ATTRIBUTE_FAMILY).toBe("family-name");
        expect(Gtk.ACCESSIBLE_ATTRIBUTE_FOREGROUND).toBe("fg-color");
    });

    it("exports numeric constant", () => {
        expect(typeof Gtk.BINARY_AGE).toBe("number");
    });

    it("exports version constants", () => {
        expect(typeof Gtk.MAJOR_VERSION).toBe("number");
        expect(typeof Gtk.MINOR_VERSION).toBe("number");
        expect(typeof Gtk.MICRO_VERSION).toBe("number");
        expect(Gtk.MAJOR_VERSION).toBeGreaterThanOrEqual(4);
    });

    it("exports text-related constants", () => {
        expect(typeof Gtk.TEXT_VIEW_PRIORITY_VALIDATE).toBe("number");
    });
});
