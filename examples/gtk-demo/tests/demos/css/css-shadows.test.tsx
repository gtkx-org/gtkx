import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { cssShadowsDemo } from "../../../src/demos/css/css-shadows.js";
import { renderDemo } from "../../test-utils.js";

describe("cssShadowsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(cssShadowsDemo.id).toBe("css-shadows");
        expect(cssShadowsDemo.title).toBe("Theming/Shadows");
        expect(cssShadowsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(cssShadowsDemo.keywords)).toBe(true);
        expect(typeof cssShadowsDemo.sourceCode).toBe("string");
        expect(cssShadowsDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(cssShadowsDemo.defaultWidth).toBe(400);
        expect(cssShadowsDemo.defaultHeight).toBe(300);
        expect(cssShadowsDemo.component).toBeTypeOf("function");
    });
});

describe("cssShadowsDemo rendering", () => {
    it("renders the navigation buttons and the Hello World button", async () => {
        await renderDemo(cssShadowsDemo);
        const helloButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hello World" });
        expect(helloButton).toBeInstanceOf(Gtk.Button);
    });

    it("renders a paned container holding the text view editor", async () => {
        await renderDemo(cssShadowsDemo);
        const paned = (await screen.findByName("paned")) as Gtk.Paned;
        expect(paned).toBeInstanceOf(Gtk.Paned);
        expect(paned.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(paned.getResizeStartChild()).toBe(false);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        expect(textView).toBeInstanceOf(Gtk.TextView);
        const buffer = textView.getBuffer();
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toContain("window.demo.background");
        expect(text).toContain("text-shadow");
    });
});

describe("cssShadowsDemo behavior", () => {
    it("declares both demo and background css classes on the host window", async () => {
        expect(cssShadowsDemo.windowCssClasses).toEqual(["demo", "background"]);
        await renderDemo(cssShadowsDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        expect(window.hasCssClass("demo")).toBe(true);
        expect(window.hasCssClass("background")).toBe(true);
    });

    it("loads the default CSS into a CssProvider when the editor mounts", async () => {
        const loadSpy = vi.spyOn(Gtk.CssProvider.prototype, "loadFromString");
        try {
            await renderDemo(cssShadowsDemo);
            const defaultLoad = loadSpy.mock.calls.find(
                ([css]) => typeof css === "string" && css.includes("text-shadow"),
            );
            expect(defaultLoad, "expected the default shadows CSS to be loaded via loadFromString").toBeDefined();
        } finally {
            loadSpy.mockRestore();
        }
    });

    it("re-applies the CssProvider when the user edits the buffer", async () => {
        const loadSpy = vi.spyOn(Gtk.CssProvider.prototype, "loadFromString");
        try {
            await renderDemo(cssShadowsDemo);
            const textView = (await screen.findByName("text-view")) as Gtk.TextView;
            const buffer = textView.getBuffer();
            loadSpy.mockClear();
            await act(() => buffer.setText("button { box-shadow: 0 0 10px red; }", -1));
            await waitFor(() => {
                const userLoad = loadSpy.mock.calls.find(
                    ([css]) => typeof css === "string" && css.includes("box-shadow: 0 0 10px red"),
                );
                expect(userLoad, "expected the buffer edit to be loaded into a CssProvider").toBeDefined();
            });
        } finally {
            loadSpy.mockRestore();
        }
    });
});
