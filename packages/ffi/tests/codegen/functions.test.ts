import { describe, expect, it } from "vitest";
import * as Gdk from "../../src/generated/gdk/index.js";
import * as Gtk from "../../src/generated/gtk/index.js";

describe("functions", () => {
    describe("namespace functions", () => {
        it("calls function with no parameters", () => {
            const modMask = Gtk.acceleratorGetDefaultModMask();
            expect(typeof modMask).toBe("number");
        });

        it("calls function with primitive parameters", () => {
            const label = Gtk.acceleratorGetLabel(65, Gdk.ModifierType.CONTROL_MASK);
            expect(typeof label).toBe("string");
        });

        it("calls function returning string", () => {
            const name = Gtk.acceleratorName(65, Gdk.ModifierType.CONTROL_MASK);
            expect(typeof name).toBe("string");
            expect(name).toContain("a");
        });

        it("calls function parsing accelerator", () => {
            const result = Gtk.acceleratorParse("<Control>a");
            expect(result).toBeDefined();
        });

        it("calls function checking version", () => {
            const major = Gtk.getMajorVersion();
            const minor = Gtk.getMinorVersion();
            const micro = Gtk.getMicroVersion();
            expect(major).toBeGreaterThanOrEqual(4);
            expect(typeof minor).toBe("number");
            expect(typeof micro).toBe("number");
        });

        it("calls function returning boolean", () => {
            const valid = Gtk.acceleratorValid(65, Gdk.ModifierType.CONTROL_MASK);
            expect(typeof valid).toBe("boolean");
        });
    });

    describe("cross-namespace functions", () => {
        it("calls function with cross-namespace return type", () => {
            const modMask = Gtk.acceleratorGetDefaultModMask();
            expect(typeof modMask).toBe("number");
        });
    });
});
