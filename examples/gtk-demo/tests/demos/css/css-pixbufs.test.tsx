import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { cssPixbufsDemo } from "../../../src/demos/css/css-pixbufs.js";
import { renderDemo } from "../../test-utils.js";

describe("cssPixbufsDemo", () => {
    it("exposes the expected metadata", () => {
        expect(cssPixbufsDemo.id).toBe("css-pixbufs");
        expect(cssPixbufsDemo.title).toBe("Theming/Animated Backgrounds");
        expect(cssPixbufsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(cssPixbufsDemo.keywords)).toBe(true);
        expect(typeof cssPixbufsDemo.sourceCode).toBe("string");
        expect(cssPixbufsDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(cssPixbufsDemo.defaultWidth).toBe(400);
        expect(cssPixbufsDemo.defaultHeight).toBe(300);
        expect(cssPixbufsDemo.component).toBeTypeOf("function");
    });

    it("renders a vertical paned wrapping the text view editor", async () => {
        await renderDemo(cssPixbufsDemo);
        const paned = (await screen.findByName("paned")) as Gtk.Paned;
        expect(paned).toBeInstanceOf(Gtk.Paned);
        expect(paned.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        const sw = await screen.findByName("scrolled");
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
    });

    it("preloads the default CSS containing the keyframe animations", async () => {
        await renderDemo(cssPixbufsDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        const buffer = textView.getBuffer();
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toContain("@keyframes move-the-image");
        expect(text).toContain("@keyframes size-the-image");
        expect(text).toContain("animation: move-the-image");
    });

    it("declares the demo window class on the host window", async () => {
        expect(cssPixbufsDemo.windowCssClasses).toEqual(["demo"]);
        await renderDemo(cssPixbufsDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        expect(window.hasCssClass("demo")).toBe(true);
    });

    it("loads the default keyframe CSS into a CssProvider when the editor mounts", async () => {
        const loadSpy = vi.spyOn(Gtk.CssProvider.prototype, "loadFromString");
        try {
            await renderDemo(cssPixbufsDemo);
            const defaultLoad = loadSpy.mock.calls.find(
                ([css]) => typeof css === "string" && css.includes("@keyframes move-the-image"),
            );
            expect(defaultLoad, "expected the default pixbufs CSS to be loaded via loadFromString").toBeDefined();
        } finally {
            loadSpy.mockRestore();
        }
    });

    it("re-applies the CssProvider when the user edits the buffer", async () => {
        const loadSpy = vi.spyOn(Gtk.CssProvider.prototype, "loadFromString");
        try {
            await renderDemo(cssPixbufsDemo);
            const textView = (await screen.findByName("text-view")) as Gtk.TextView;
            const buffer = textView.getBuffer();
            loadSpy.mockClear();
            await act(() => buffer.setText("window { background-color: cyan; }", -1));
            await waitFor(() => {
                const userLoad = loadSpy.mock.calls.find(
                    ([css]) => typeof css === "string" && css.includes("background-color: cyan"),
                );
                expect(userLoad, "expected the buffer edit to be loaded into a CssProvider").toBeDefined();
            });
        } finally {
            loadSpy.mockRestore();
        }
    });
});
