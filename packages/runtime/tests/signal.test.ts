import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import "@gtkx/gi/gobject";

describe("emitSignal — basic dispatch", () => {
    it("emits a void signal with no arguments and invokes connected handlers", () => {
        const button = new Gtk.Button();
        let calls = 0;
        button.on("clicked", () => {
            calls += 1;
        });
        button.emit("clicked");
        expect(calls).toBe(1);
    });

    it("emits a signal with primitive arguments and forwards them to the handler", () => {
        const window = new Gtk.Window();
        const received: boolean[] = [];
        window.on("enable-debugging", (enabled) => {
            received.push(enabled);
        });
        window.emit("enable-debugging", true);
        expect(received).toEqual([true]);
    });

    it("returns undefined from any signal emission", () => {
        const button = new Gtk.Button();
        let calls = 0;
        button.on("clicked", () => {
            calls += 1;
        });
        const emitClicked: (signal: "clicked") => unknown = button.emit.bind(button);
        expect(emitClicked("clicked")).toBeUndefined();
        expect(calls).toBe(1);
    });
});

describe("editable signal handlers", () => {
    it("preserves the order of distinct deletion positions without an emitter argument", () => {
        const entry = new Gtk.Entry({ text: "hello" });
        const received: unknown[][] = [];
        entry.on("delete-text", (...args) => {
            received.push(args);
        });

        entry.deleteText(1, 4);

        expect(received).toEqual([[1, 4]]);
        expect(entry.getText()).toBe("ho");
    });

    it("preserves an insertion position when a handler returns no replacement", () => {
        const entry = new Gtk.Entry({ text: "hello" });
        const received: unknown[][] = [];
        entry.on("insert-text", (...args) => {
            received.push(args);
        });

        expect(entry.insertText("!", 1, 2)).toBe(3);
        expect(received).toEqual([["!", 1, 2]]);
        expect(entry.getText()).toBe("he!llo");
    });

    it("allows a surrounding text update when an insertion handler returns nothing", () => {
        const entry = new Gtk.Entry();
        entry.on("insert-text", () => undefined);

        entry.setText("hello");

        expect(entry.getText()).toBe("hello");
    });

    it("preserves another handler's replacement position when an observer returns nothing", () => {
        const entry = new Gtk.Entry({ text: "hello" });
        const received: number[] = [];
        entry.on("insert-text", () => 1);
        entry.on("insert-text", (_text, _length, position) => {
            received.push(position);
        });

        expect(entry.insertText("!", 1, 4)).toBe(2);
        expect(received).toEqual([1]);
        expect(entry.getText()).toBe("h!ello");
    });
});

describe("emitSignal — inheritance and errors", () => {
    it("emits an inherited signal via super.emit fallthrough", () => {
        const button = new Gtk.Button();
        let calls = 0;
        button.on("destroy", () => {
            calls += 1;
        });
        button.emit("destroy");
        expect(calls).toBe(1);
    });

    it("emits a signal with a GObject argument", () => {
        const listBox = new Gtk.ListBox();
        const row = new Gtk.ListBoxRow();
        listBox.append(row);
        const received: Gtk.ListBoxRow[] = [];
        listBox.on("row-activated", (activated) => {
            received.push(activated);
        });
        listBox.emit("row-activated", row);
        expect(received).toEqual([row]);
    });

    it("throws on an unknown signal at the GObject root", () => {
        const button = new Gtk.Button();

        const object = button as GObject.Object;
        expect(() => {
            Reflect.apply(object.emit.bind(object), object, ["not-a-real-signal"]);
        }).toThrow();
    });
});

describe("emitSignal — detailed signals", () => {
    it("delivers a detailed emission only to handlers watching that detail", () => {
        const bar = new Gtk.LevelBar();
        const scoped: string[] = [];
        const undetailed: string[] = [];
        bar.on("offset-changed::low", (name) => {
            scoped.push(name);
        });
        bar.on("offset-changed", (name) => {
            undetailed.push(name);
        });
        bar.emit("offset-changed::low", "low");
        bar.emit("offset-changed::high", "high");
        expect(scoped).toEqual(["low"]);
        expect(undetailed).toEqual(["low", "high"]);
    });

    it("delivers a notify detail only for the property that changed", () => {
        const button = new Gtk.Button();
        let calls = 0;
        button.on("notify::label", () => {
            calls += 1;
        });
        button.setLabel("changed");
        button.setOpacity(0.5);
        expect(calls).toBe(1);
    });
});
