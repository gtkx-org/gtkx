import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { cssBasicsDemo } from "../../../src/demos/css/css-basics.js";
import { renderDemo, screen } from "../../test-utils.js";

describe("cssBasicsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(cssBasicsDemo.id).toBe("css-basics");
        expect(cssBasicsDemo.title).toBe("Theming/CSS Basics");
        expect(cssBasicsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(cssBasicsDemo.keywords)).toBe(true);
        expect(typeof cssBasicsDemo.sourceCode).toBe("string");
        expect(cssBasicsDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(cssBasicsDemo.defaultWidth).toBe(400);
        expect(cssBasicsDemo.defaultHeight).toBe(300);
        expect(cssBasicsDemo.component).toBeTypeOf("function");
    });
});

describe("cssBasicsDemo rendering", () => {
    it("renders a text view inside a scrolled window with the default CSS preloaded", async () => {
        await renderDemo(cssBasicsDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        expect(textView).toBeInstanceOf(Gtk.TextView);
        const sw = await screen.findByName("scrolled");
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        const buffer = textView.getBuffer();
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toContain("Set a very futuristic style by default");
        expect(text).toContain("window.demo");
        expect(text).toContain("color: green");
    });

    it("adds the demo css class to the host window on mount and removes it on unmount", async () => {
        const { window, unmount } = await renderDemo(cssBasicsDemo);
        const win = window.current;
        expect(win).not.toBeNull();
        if (!win) return;
        expect(win.hasCssClass("demo")).toBe(true);
        await unmount();
        expect(win.hasCssClass("demo")).toBe(false);
    });
});

describe("cssBasicsDemo behavior", () => {
    it("propagates edited buffer text back into the text view", async () => {
        await renderDemo(cssBasicsDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        const buffer = textView.getBuffer();
        buffer.setText("/* edited */\nwindow { color: red; }\n", -1);
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toBe("/* edited */\nwindow { color: red; }\n");
    });

    it("loads invalid CSS without crashing the parsing-error handler", async () => {
        await renderDemo(cssBasicsDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        const buffer = textView.getBuffer();
        buffer.setText("window { color: this-is-not-a-valid-color; }", -1);
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toContain("this-is-not-a-valid-color");
    });
});
