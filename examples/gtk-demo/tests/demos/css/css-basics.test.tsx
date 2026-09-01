import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssBasicsDemo } from "../../../src/demos/css/css-basics.js";
import { hasBufferTag, renderDemo } from "../../test-utils.js";

const renderTextView = async (): Promise<Gtk.TextView> => {
    await renderDemo(cssBasicsDemo);

    return await screen.findByName("text-view", { as: Gtk.TextView });
};

const replaceCss = async (textView: Gtk.TextView, css: string): Promise<void> => {
    await userEvent.clear(textView);
    await userEvent.type(textView, css);
};

describe("cssBasicsDemo rendering", () => {
    it("renders a text view inside a scrolled window with the default CSS preloaded", async () => {
        const textView = await renderTextView();
        await screen.findByName("scrolled");
        expect(textView).toHaveDisplayValue(/Set a very futuristic style by default/);
        expect(textView).toHaveDisplayValue(/window\.demo/);
        expect(textView).toHaveDisplayValue(/color: green/);
    });

    it("declares the demo css class on the host window", async () => {
        expect(cssBasicsDemo.windowCssClasses).toEqual(["demo"]);
        await renderDemo(cssBasicsDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        expect(window).toHaveClass("demo");
    });
});

describe("cssBasicsDemo behavior", () => {
    it("propagates edited buffer text back into the text view", async () => {
        const textView = await renderTextView();
        await replaceCss(textView, "/* edited */\nwindow { color: red; }\n");
        expect(textView).toHaveDisplayValue("/* edited */\nwindow { color: red; }\n");
    });

    it("updates diagnostic tags as invalid, warning-level, and valid CSS is entered", async () => {
        const textView = await renderTextView();
        await replaceCss(textView, "window { color: this-is-not-a-valid-color; }");

        await waitFor(() => {
            expect(hasBufferTag(textView, "error")).toBe(true);
        });

        expect(hasBufferTag(textView, "warning")).toBe(false);
        await replaceCss(textView, "window { color: green }");

        await waitFor(() => {
            expect(hasBufferTag(textView, "warning")).toBe(true);
        });

        expect(hasBufferTag(textView, "error")).toBe(false);
        await replaceCss(textView, "window { color: red; }");

        await waitFor(() => {
            expect(hasBufferTag(textView, "error")).toBe(false);
        });

        expect(hasBufferTag(textView, "warning")).toBe(false);
    });
});
