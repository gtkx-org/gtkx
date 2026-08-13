import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { cssMultiplebgsDemo } from "../../../src/demos/css/css-multiplebgs.js";
import { expectCssReloadedOnEdit, hasBufferTag, renderDemo } from "../../test-utils.js";

describe("cssMultiplebgsDemo", () => {
    it("exposes the expected metadata", () => {
        expect(cssMultiplebgsDemo.id).toBe("css-multiplebgs");
        expect(cssMultiplebgsDemo.title).toBe("Theming/Multiple Backgrounds");

        expect(cssMultiplebgsDemo.description).toBe(
            "GTK themes are written using CSS. Every widget is build of multiple items " +
            "that you can style very similarly to a regular website.",
        );

        expect(cssMultiplebgsDemo.keywords).toEqual([]);
        expect(cssMultiplebgsDemo.sourceCode).toContain("const cssMultiplebgsDemo: Demo = {");
        expect(cssMultiplebgsDemo.defaultWidth).toBe(400);
        expect(cssMultiplebgsDemo.defaultHeight).toBe(300);
        expect(cssMultiplebgsDemo.component).toBeTypeOf("function");
    });

    it("renders an overlay with a canvas drawing area and the bricks button", async () => {
        await renderDemo(cssMultiplebgsDemo);
        const overlay = await screen.findByName("overlay", { as: Gtk.Overlay });
        const canvas = await screen.findByName("canvas", { as: Gtk.DrawingArea });
        const bricksButton = await screen.findByName("bricks-button", { as: Gtk.Button });
        expect(overlay.getChild()).toBe(canvas);
        expect(overlay).toContainElement(bricksButton);
        expect(canvas).toHaveObjectProperty("hexpand", true);
        expect(canvas).toHaveObjectProperty("vexpand", true);
    });

    it("splits the editor from the canvas with a vertical paned holding the editor as its end child", async () => {
        await renderDemo(cssMultiplebgsDemo);
        const paned = await screen.findByName("paned", { as: Gtk.Paned });
        expect(paned.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(paned.getStartChild()).toBeEmptyWidget();
        const textView = await screen.findByName("text-view", { as: Gtk.TextView });
        expect(paned.getEndChild()).toContainElement(textView);
        expect(textView).toHaveDisplayValue(/#canvas/);
        expect(textView).toHaveDisplayValue(/transition-property/);
    });

    it("declares the demo window class on the host window", async () => {
        expect(cssMultiplebgsDemo.windowCssClasses).toEqual(["demo"]);
        await renderDemo(cssMultiplebgsDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        expect(window).toHaveClass("demo");
    });
});

describe("cssMultiplebgsDemo css provider", () => {
    it("loads the default CSS into a CssProvider added to the display on mount", async () => {
        const loadSpy = vi.spyOn(Gtk.CssProvider.prototype, "loadFromString");
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const addSpy = vi.spyOn(Gtk.StyleContext, "addProviderForDisplay");

        try {
            await renderDemo(cssMultiplebgsDemo);

            const defaultLoad = loadSpy.mock.calls.find(
                ([css]) => typeof css === "string" && css.includes("#canvas") && css.includes("transition-property"),
            );

            expect(defaultLoad, "expected the default multiplebgs CSS to be loaded via loadFromString").toBeDefined();
            expect(addSpy.mock.calls.some(([, provider]) => provider instanceof Gtk.CssProvider)).toBe(true);
        } finally {
            loadSpy.mockRestore();
            addSpy.mockRestore();
        }
    });

    it("re-applies the CssProvider when the user edits the buffer", async () => {
        await expectCssReloadedOnEdit(
            cssMultiplebgsDemo,
            "#canvas { background-color: magenta; }",
            "background-color: magenta",
        );
    });

    it("marks invalid CSS by adding an error tag to the buffer", async () => {
        await renderDemo(cssMultiplebgsDemo);
        const textView = await screen.findByName("text-view", { as: Gtk.TextView });
        await userEvent.clear(textView);
        await userEvent.type(textView, "#canvas { color: this-is-not-a-valid-color; }");

        await waitFor(() => {
            expect(hasBufferTag(textView, "error")).toBe(true);
        });
    });
});
