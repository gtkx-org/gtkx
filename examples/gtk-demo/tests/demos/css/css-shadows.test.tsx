import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssShadowsDemo } from "../../../src/demos/css/css-shadows.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findFirstOfType } from "../../helpers/traverse.js";

describe("cssShadowsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(cssShadowsDemo.id).toBe("css-shadows");
        expect(cssShadowsDemo.title).toBe("Theming/Shadows");
        expect(cssShadowsDemo.description.length).toBeGreaterThan(0);
        expect(cssShadowsDemo.keywords).toEqual(
            expect.arrayContaining(["css", "shadow", "box-shadow", "live", "editing"]),
        );
        expect(typeof cssShadowsDemo.sourceCode).toBe("string");
        expect(cssShadowsDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(cssShadowsDemo.defaultWidth).toBe(400);
        expect(cssShadowsDemo.defaultHeight).toBe(300);
        expect(cssShadowsDemo.component).toBeTypeOf("function");
    });
});

describe("cssShadowsDemo rendering", () => {
    it("renders the navigation buttons and the Hello World button", async () => {
        if (!cssShadowsDemo.component) throw new Error("css-shadows demo component missing");
        await renderDemo(cssShadowsDemo.component);
        const helloButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hello World" });
        expect(helloButton).toBeInstanceOf(Gtk.Button);
    });

    it("renders a paned container holding the text view editor", async () => {
        if (!cssShadowsDemo.component) throw new Error("css-shadows demo component missing");
        const { container } = await renderDemo(cssShadowsDemo.component);
        const paned = findFirstOfType(container, Gtk.Paned);
        expect(paned).toBeInstanceOf(Gtk.Paned);
        if (!paned) return;
        expect(paned.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(paned.getResizeStartChild()).toBe(false);
        const textView = findFirstOfType(container, Gtk.TextView);
        expect(textView).toBeInstanceOf(Gtk.TextView);
        if (!textView) return;
        const buffer = textView.getBuffer();
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toContain("window.demo.background");
        expect(text).toContain("text-shadow");
    });
});

describe("cssShadowsDemo behavior", () => {
    it("adds both demo and background css classes to the host window", async () => {
        if (!cssShadowsDemo.component) throw new Error("css-shadows demo component missing");
        const { window, unmount } = await renderDemo(cssShadowsDemo.component);
        const win = window.current;
        expect(win).not.toBeNull();
        if (!win) return;
        expect(win.hasCssClass("demo")).toBe(true);
        expect(win.hasCssClass("background")).toBe(true);
        await unmount();
        expect(win.hasCssClass("demo")).toBe(false);
        expect(win.hasCssClass("background")).toBe(false);
    });

    it("propagates user edits in the buffer back through getText", async () => {
        if (!cssShadowsDemo.component) throw new Error("css-shadows demo component missing");
        const { container } = await renderDemo(cssShadowsDemo.component);
        const textView = findFirstOfType(container, Gtk.TextView) as Gtk.TextView;
        const buffer = textView.getBuffer();
        buffer.setText("button { box-shadow: 0 0 10px red; }", -1);
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toBe("button { box-shadow: 0 0 10px red; }");
    });
});
