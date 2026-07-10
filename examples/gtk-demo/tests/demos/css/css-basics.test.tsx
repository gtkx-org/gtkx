import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssBasicsDemo } from "../../../src/demos/css/css-basics.js";
import { renderDemo } from "../../test-utils.js";

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
        expect(screen.getByDisplayValue(/Set a very futuristic style by default/)).not.toBeNull();
        expect(screen.getByDisplayValue(/window\.demo/)).not.toBeNull();
        expect(screen.getByDisplayValue(/color: green/)).not.toBeNull();
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
        expect(screen.getByDisplayValue("/* edited */\nwindow { color: red; }\n")).not.toBeNull();
    });

    it("marks invalid CSS by adding an error tag to the buffer", async () => {
        await renderDemo(cssBasicsDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        const buffer = textView.getBuffer();
        await userEvent.clear(textView);
        await userEvent.type(textView, "window { color: this-is-not-a-valid-color; }");
        const errorTag = buffer.getTagTable().lookup("error");
        expect(errorTag).toBeInstanceOf(Gtk.TextTag);
        await waitFor(() => {
            const iter = buffer.getStartIter();
            let foundError = false;
            do {
                if (errorTag && iter.hasTag(errorTag)) {
                    foundError = true;
                    break;
                }
            } while (iter.forwardChar());
            expect(foundError).toBe(true);
        });
    });
});
