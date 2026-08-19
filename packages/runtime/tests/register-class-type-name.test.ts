import { typeFromName } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");

describe("registerClass — GType name validation", () => {
    it("registers a name drawing on the full valid character set", () => {
        const name = uniqueName("Gtkx+Valid-Name");
        class Chars extends Gtk.Label {}
        registerClass(Chars, { typeName: name });
        expect(typeFromName(name)).not.toBe(0n);
    });

    it("registers a three-character name", () => {
        const name = `Gx${String(process.pid % 10)}`;
        class Tiny extends Gtk.Label {}
        registerClass(Tiny, { typeName: name });
        expect(typeFromName(name)).not.toBe(0n);
    });

    it("registers a name that starts with an underscore", () => {
        const name = uniqueName("_GtkxUnderscoreName");
        class Underscored extends Gtk.Label {}
        registerClass(Underscored, { typeName: name });
        expect(typeFromName(name)).not.toBe(0n);
    });

    it("throws for a name shorter than three characters", () => {
        class Short extends Gtk.Label {}
        expect(() => registerClass(Short, { typeName: "Ab" })).toThrow();
    });

    it("throws for a class whose own name is too short to derive from", () => {
        class Ab extends Gtk.Label {}
        expect(() => registerClass(Ab)).toThrow();
    });

    it("throws for a name that starts with a digit", () => {
        class Digit extends Gtk.Label {}
        expect(() => registerClass(Digit, { typeName: "1GtkxDigitName" })).toThrow();
    });

    it("throws for a name with characters outside the GType set", () => {
        class Punct extends Gtk.Label {}
        expect(() => registerClass(Punct, { typeName: "Gtkx BadName!" })).toThrow();
    });

    it("throws for an anonymous class with no typeName", () => {
        expect(() => registerClass(class extends Gtk.Label {})).toThrow();
    });

    it("throws when the name is already registered", () => {
        const name = uniqueName("GtkxNameCollision");
        class First extends Gtk.Label {}
        class Second extends Gtk.Label {}
        registerClass(First, { typeName: name });
        expect(() => registerClass(Second, { typeName: name })).toThrow();
    });
});
