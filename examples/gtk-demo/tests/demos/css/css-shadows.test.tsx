import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { cssShadowsDemo } from "../../../src/demos/css/css-shadows.js";
import { renderDemo } from "../../test-utils.js";

const hasTagToggle = (view: Gtk.TextView, tagName: string): boolean => {
    const buffer = view.getBuffer();
    const tag = buffer.getTagTable().lookup(tagName);
    if (!tag) return false;
    const iter = buffer.getStartIter();
    return iter.forwardToTagToggle(tag);
};

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
        expect(helloButton).toHaveTextContent("Hello World");
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Go Next" });
        await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Go Previous" });
    });

    it("renders a paned container holding the text view editor with the default CSS", async () => {
        await renderDemo(cssShadowsDemo);
        await screen.findByName("paned");
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        expect(textView).toHaveDisplayValue(/window\.demo\.background/);
        expect(textView).toHaveDisplayValue(/text-shadow/);
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
            loadSpy.mockClear();
            await userEvent.clear(textView);
            await userEvent.type(textView, "button { box-shadow: 0 0 10px red; }");
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

    it("underlines invalid CSS with an error tag in the buffer", async () => {
        await renderDemo(cssShadowsDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        await userEvent.clear(textView);
        await waitFor(() => {
            expect(hasTagToggle(textView, "error")).toBe(false);
        });
        await userEvent.type(textView, "button { nonsense-prop: 5px; }");
        await waitFor(() => {
            expect(hasTagToggle(textView, "error")).toBe(true);
        });
    });

    it("clears previously applied error tags once the buffer is edited to valid CSS", async () => {
        await renderDemo(cssShadowsDemo);
        const textView = (await screen.findByName("text-view")) as Gtk.TextView;
        await userEvent.clear(textView);
        await userEvent.type(textView, "button { nonsense-prop: 5px; }");
        await waitFor(() => {
            expect(hasTagToggle(textView, "error")).toBe(true);
        });
        await userEvent.clear(textView);
        await userEvent.type(textView, "button { color: red; }");
        await waitFor(() => {
            expect(hasTagToggle(textView, "error")).toBe(false);
        });
    });
});
