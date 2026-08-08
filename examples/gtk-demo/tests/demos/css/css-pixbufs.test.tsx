import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssPixbufsDemo } from "../../../src/demos/css/css-pixbufs.js";
import { expectCssReloadedOnEdit, findCssLoadedOnMount, hasBufferTag, renderDemo } from "../../test-utils.js";

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

    it("renders a vertical paned holding the scrolled text view editor as its end child", async () => {
        await renderDemo(cssPixbufsDemo);
        const paned = await screen.findByName("paned", { as: Gtk.Paned });
        expect(paned.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(paned.getStartChild()).toBeInstanceOf(Gtk.Box);
        expect(paned.getEndChild()).toBeInstanceOf(Gtk.ScrolledWindow);
        await screen.findByName("scrolled");
    });

    it("preloads the default CSS containing the keyframe animations", async () => {
        await renderDemo(cssPixbufsDemo);
        const textView = await screen.findByName("text-view", { as: Gtk.TextView });
        expect(textView).toHaveDisplayValue(/@keyframes move-the-image/);
        expect(textView).toHaveDisplayValue(/@keyframes size-the-image/);
        expect(textView).toHaveDisplayValue(/animation: move-the-image/);
    });

    it("declares the demo window class on the host window", async () => {
        expect(cssPixbufsDemo.windowCssClasses).toEqual(["demo"]);
        await renderDemo(cssPixbufsDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        expect(window).toHaveClass("demo");
    });
});

describe("cssPixbufsDemo css provider", () => {
    it("loads the default keyframe CSS into a CssProvider when the editor mounts", async () => {
        const loaded = await findCssLoadedOnMount(cssPixbufsDemo, "@keyframes move-the-image");
        expect(loaded, "expected the default pixbufs CSS to be loaded via loadFromString").toBeDefined();
    });

    it("re-applies the CssProvider when the user edits the buffer", async () => {
        await expectCssReloadedOnEdit(
            cssPixbufsDemo,
            "window { background-color: cyan; }",
            "background-color: cyan",
        );
    });

    it("marks invalid CSS with an error tag and clears it once the CSS is valid again", async () => {
        await renderDemo(cssPixbufsDemo);
        const textView = await screen.findByName("text-view", { as: Gtk.TextView });
        await userEvent.clear(textView);
        await userEvent.type(textView, "window { color: this-is-not-a-valid-color; }");

        await waitFor(() => {
            expect(hasBufferTag(textView, "error")).toBe(true);
        });

        await userEvent.clear(textView);
        await userEvent.type(textView, "window { color: red; }");

        await waitFor(() => {
            expect(hasBufferTag(textView, "error")).toBe(false);
        });
    });
});
