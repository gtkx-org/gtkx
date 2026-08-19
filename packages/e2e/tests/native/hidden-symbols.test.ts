import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

const HIDDEN_GLIB_FUNCTIONS = [
    "asciiDtostr",
    "asciiFormatd",
    "logSetWriterFunc",
    "refStringAcquire",
    "refStringLength",
    "refStringNew",
    "refStringNewIntern",
    "refStringNewLen",
    "refStringRelease",
    "stpcpy",
    "strcanon",
    "strchomp",
    "strchug",
    "strdelimit",
    "strdown",
    "strreverse",
    "strup",
    "threadExit",
    "threadNew",
    "threadTryNew",
];

const HIDDEN_OBJECT_METHODS = ["getData", "getQdata", "setData", "setQdata", "stealData", "stealQdata"];
const HIDDEN_PARAM_SPEC_METHODS = ["getQdata", "setQdata", "stealQdata"];

const expectHidden = (target: object, names: string[]): void => {
    for (const name of names) {
        expect(Reflect.get(target, name)).toBeUndefined();
    }
};

const callHidden = (target: object, name: string, ...args: unknown[]): unknown => {
    const member: unknown = Reflect.get(target, name);

    return (member as (...callArgs: unknown[]) => unknown).call(target, ...args);
};

describe("symbols GTKX keeps next to the hidden ones", () => {
    it("binds the string helpers that hand back borrowed memory", () => {
        expect(GLib.strstrLen("needle in haystack", -1, "in")).toBe("in haystack");
        expect(GLib.strrstr("a-b-c", "-")).toBe("-c");
        expect(GLib.strrstrLen("a-b-c", -1, "-")).toBe("-c");
        expect(GLib.asciiStrup("abc", -1)).toBe("ABC");
        expect(GLib.asciiStrdown("ABC", -1)).toBe("abc");
        expect(GLib.internString("gtkx-probe")).toBe("gtkx-probe");
        expect(typeof GLib.uuidStringRandom()).toBe("string");
    });

    it("binds the logging and thread entry points that stay on the main thread", () => {
        expect(typeof GLib.logSetHandler).toBe("function");
        expect(typeof GLib.logRemoveHandler).toBe("function");
        expect(typeof GLib.logWriterDefault).toBe("function");
        expect(GLib.Thread.self()).toBeInstanceOf(GLib.Thread);
        expect(typeof GLib.Thread.prototype.join).toBe("function");
    });

    it("binds the typed attribute setters and the action map entry points", () => {
        const info = new Gio.FileInfo();
        info.setAttributeString("gtkx::name", "value");
        expect(info.getAttributeString("gtkx::name")).toBe("value");
        expect(typeof Gio.File.newForPath("/").setAttributeString).toBe("function");
        const group = new Gio.SimpleActionGroup();
        group.addAction(new Gio.SimpleAction({ name: "probe" }));
        expect(group.hasAction("probe")).toBe(true);
    });

    it("binds the object and param spec members around the raw pointer accessors", () => {
        const label = new Gtk.Label();
        expect(label.isFloating()).toBe(false);
        label.setProperty("label", "probe");
        expect(label.getLabel()).toBe("probe");
        const spec = GObject.paramSpecString("probe", null, null, "x", GObject.ParamFlags.READWRITE);
        expect(spec.getName()).toBe("probe");
    });
});

describe("symbols GTKX hides from the generated modules", () => {
    it("leaves the GLib functions that return or misuse their input buffer out of the namespace", () => {
        expectHidden(GLib, HIDDEN_GLIB_FUNCTIONS);
    });

    it("leaves the thread constructors and the exit function off the Thread class", () => {
        expectHidden(GLib.Thread, ["new", "tryNew", "exit"]);
    });

    it("leaves the raw data accessors off GObject and ParamSpec and their subclasses", () => {
        expectHidden(GObject.Object.prototype, HIDDEN_OBJECT_METHODS);
        expectHidden(Gtk.Label.prototype, HIDDEN_OBJECT_METHODS);
        expectHidden(GObject.ParamSpec.prototype, HIDDEN_PARAM_SPEC_METHODS);
    });

    it("leaves the raw pointer setters and add_action_entries off the Gio types", () => {
        expectHidden(Gio.File.newForPath("/"), ["setAttribute"]);
        expectHidden(Gio.FileInfo.prototype, ["setAttribute"]);
        expectHidden(Gio.ActionMap.prototype, ["addActionEntries"]);
        expectHidden(Gio.SimpleActionGroup.prototype, ["addActionEntries"]);
        expectHidden(new Gtk.Application(), ["addActionEntries"]);
    });
});

describe("reaching a hidden symbol anyway", () => {
    it("throws when a hidden GLib function is called through the namespace", () => {
        expect(() => callHidden(GLib, "strchug", "  padded  ")).toThrow();
        expect(() => callHidden(GLib, "logSetWriterFunc")).toThrow();
        expect(() => callHidden(GLib.Thread, "new", "worker", () => null)).toThrow();
    });

    it("throws when a hidden method is called through an instance", () => {
        const label = new Gtk.Label();
        expect(() => callHidden(label, "setData", "gtkx", 1n)).toThrow();
        expect(() => callHidden(label, "getData", "gtkx")).toThrow();
        expect(() => callHidden(new Gio.FileInfo(), "setAttribute", "a", 0, 0n)).toThrow();
        expect(() => callHidden(new Gio.SimpleActionGroup(), "addActionEntries", [], null)).toThrow();
    });
});
