import { describe, expect, it } from "vitest";
import * as Gdk from "../../src/generated/gdk/index.js";
import * as Gtk from "../../src/generated/gtk/index.js";
import { createRef } from "../../src/index.js";

describe("ref parameters", () => {
    describe("output parameters via function calls", () => {
        it("receives key and modifiers via refs from acceleratorParse", () => {
            const keyRef = createRef<number>(0);
            const modsRef = createRef<Gdk.ModifierType>(0);

            const success = Gtk.acceleratorParse("<Control>a", keyRef, modsRef);

            expect(success).toBe(true);
            expect(keyRef.value).toBe(97);
            expect(modsRef.value).toBe(Gdk.ModifierType.CONTROL_MASK);
        });

        it("receives outputs with multiple modifiers", () => {
            const keyRef = createRef<number>(0);
            const modsRef = createRef<Gdk.ModifierType>(0);

            const success = Gtk.acceleratorParse("<Control><Shift>x", keyRef, modsRef);

            expect(success).toBe(true);
            expect(keyRef.value).toBe(120);
            const expectedMods = Gdk.ModifierType.CONTROL_MASK | Gdk.ModifierType.SHIFT_MASK;
            expect(modsRef.value).toBe(expectedMods);
        });

        it("receives key without modifiers", () => {
            const keyRef = createRef<number>(0);
            const modsRef = createRef<Gdk.ModifierType>(0);

            const success = Gtk.acceleratorParse("a", keyRef, modsRef);

            expect(success).toBe(true);
            expect(keyRef.value).toBe(97);
            expect(modsRef.value).toBe(0);
        });

        it("returns false for invalid accelerator", () => {
            const keyRef = createRef<number>(0);
            const modsRef = createRef<Gdk.ModifierType>(0);

            const success = Gtk.acceleratorParse("not-a-valid-accelerator-format!!!", keyRef, modsRef);

            expect(success).toBe(false);
        });
    });

    describe("createRef utility", () => {
        it("creates ref object with initial value", () => {
            const ref = createRef<number>(42);
            expect(ref.value).toBe(42);
        });

        it("ref value can be mutated", () => {
            const ref = createRef<string>("initial");
            ref.value = "updated";
            expect(ref.value).toBe("updated");
        });

        it("createRef is exported", () => {
            expect(createRef).toBeDefined();
            expect(typeof createRef).toBe("function");
        });
    });
});
