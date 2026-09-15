import { SimpleAction } from "@gtkx/gi/gio";
import { Regex } from "@gtkx/gi/glib";
import { ObjectClass, ParamFlags, paramSpecInt, TYPE_INT, TYPE_INVALID, TYPE_STRING } from "@gtkx/gi/gobject";
import { Button, WidgetClass } from "@gtkx/gi/gtk";
import { getClassType } from "@gtkx/runtime";
import { assert, describe, expect, it } from "vitest";

const MATCH_METHODS = ["match", "matchAll"] as const;
const FULL_MATCH_METHODS = ["matchFull", "matchAllFull"] as const;

describe("generated GLib.Regex overrides", () => {
    it.each(MATCH_METHODS)("%s retains the subject for the returned match info", (method) => {
        const regex = Regex.new("a+", 0, 0);
        assert(regex);
        const [matched, info] = regex[method]("caaa", 0);
        globalThis.gc?.();
        expect(matched).toBe(true);
        expect(info.fetch(0)).toBe("aaa");
    });

    it.each(MATCH_METHODS)("%s returns false for an unmatched subject", (method) => {
        const regex = Regex.new("a+", 0, 0);
        assert(regex);
        const [matched, info] = regex[method]("", 0);
        expect(matched).toBe(false);
        expect(info.matches()).toBe(false);
    });

    it.each(FULL_MATCH_METHODS)("%s accepts a split subject and a byte offset", (method) => {
        const regex = Regex.new("a+", 0, 0);
        assert(regex);
        const [matched, info] = regex[method](["é", "aaa"], 2, 0);
        expect(matched).toBe(true);
        expect(info.fetch(0)).toBe("aaa");
    });

    it.each(FULL_MATCH_METHODS)("%s throws for an offset inside a UTF-8 codepoint", (method) => {
        const regex = Regex.new("a+", 0, 0);
        assert(regex);
        expect(() => regex[method]("éaaa", 1, 0)).toThrow();
    });
});

describe("generated class peek overrides", () => {
    it("reads GObject properties through the generated class struct", () => {
        const typeClass = ObjectClass.peek(SimpleAction);
        expect(typeClass.findProperty("name").name).toBe("name");
    });

    it("accepts a registered GType directly", () => {
        const typeClass = ObjectClass.peek(getClassType(SimpleAction));
        expect(typeClass.findProperty("name").ownerType).toBe(getClassType(SimpleAction));
    });

    it("reads GTK class metadata through the generated widget class", () => {
        const typeClass = WidgetClass.peek(Button);
        expect(typeClass.getCssName()).toBe("button");
    });

    it("rejects a non-object GType", () => {
        expect(() => ObjectClass.peek(TYPE_STRING)).toThrow();
    });

    it("rejects an object type outside the widget hierarchy", () => {
        expect(() => WidgetClass.peek(SimpleAction)).toThrow();
    });
});

describe("generated ParamSpec getters", () => {
    it("exposes the native name, descriptions, type and flags", () => {
        const spec = paramSpecInt("level", "Level", "Current level", 0, 10, 3, ParamFlags.READWRITE);
        expect(spec.name).toBe("level");
        expect(spec.nick).toBe("Level");
        expect(spec.blurb).toBe("Current level");
        expect(spec.flags).toBe(ParamFlags.READWRITE);
        expect(spec.valueType).toBe(TYPE_INT);
        expect(spec.ownerType).toBe(TYPE_INVALID);
    });

    it("preserves an absent blurb and the canonical property name", () => {
        const spec = paramSpecInt("current_level", null, null, 0, 10, 3, ParamFlags.READWRITE);
        expect(spec.name).toBe("current-level");
        expect(spec.nick).toBe("current-level");
        expect(spec.blurb).toBeNull();
    });
});
