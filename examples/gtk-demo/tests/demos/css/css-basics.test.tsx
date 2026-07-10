import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssBasicsDemo } from "../../../src/demos/css/css-basics.js";
import { bufferHasTag, renderDemo } from "../../test-utils.js";

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
        await screen.findByName("scrolled");
        expect(textView).toHaveDisplayValue(/Set a very futuristic style by default/);
        expect(textView).toHaveDisplayValue(/window\.demo/);
        expect(textView).toHaveDisplayValue(/color: green/);
    });

    it("declares the demo css class on the host window", async () => {
        expect(cssBasicsDemo.windowCssClasses).toEqual(["demo"]);
        await renderDemo(cssBasicsDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        expect(window.hasCssClass("demo")).toBe(true);
    });
});

describe("cssBasicsDemo behavior", () => {
    it("propagates edited buffer text back into the text view", async () => {
        await renderDemo(cssBasicsDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        await userEvent.clear(textView);
        await userEvent.type(textView, "/* edited */\nwindow { color: red; }\n");
        expect(textView).toHaveDisplayValue("/* edited */\nwindow { color: red; }\n");
    });

    it("marks invalid CSS by adding an error tag to the buffer", async () => {
        await renderDemo(cssBasicsDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        await userEvent.clear(textView);
        await userEvent.type(textView, "window { color: this-is-not-a-valid-color; }");
        await waitFor(() => {
            expect(bufferHasTag(textView, "error")).toBe(true);
        });
        expect(bufferHasTag(textView, "warning")).toBe(false);
    });

    it("marks warning-level CSS with the warning tag rather than the error tag", async () => {
        await renderDemo(cssBasicsDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        await userEvent.clear(textView);
        await userEvent.type(textView, "window { color: green }");
        await waitFor(() => {
            expect(bufferHasTag(textView, "warning")).toBe(true);
        });
        expect(bufferHasTag(textView, "error")).toBe(false);
    });

    it("clears a previously applied error tag once the CSS becomes valid again", async () => {
        await renderDemo(cssBasicsDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        await userEvent.clear(textView);
        await userEvent.type(textView, "window { color: this-is-not-a-valid-color; }");
        await waitFor(() => {
            expect(bufferHasTag(textView, "error")).toBe(true);
        });
        await userEvent.clear(textView);
        await userEvent.type(textView, "window { color: red; }");
        await waitFor(() => {
            expect(bufferHasTag(textView, "error")).toBe(false);
        });
        expect(bufferHasTag(textView, "warning")).toBe(false);
    });
});
