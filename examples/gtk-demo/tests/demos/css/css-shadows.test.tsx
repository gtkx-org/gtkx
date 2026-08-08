import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssShadowsDemo } from "../../../src/demos/css/css-shadows.js";
import { expectCssReloadedOnEdit, findCssLoadedOnMount, hasBufferTag, renderDemo } from "../../test-utils.js";

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
        const textView = await screen.findByName("text-view", { as: Gtk.TextView });
        expect(textView).toHaveDisplayValue(/window\.demo\.background/);
        expect(textView).toHaveDisplayValue(/text-shadow/);
    });
});

describe("cssShadowsDemo behavior", () => {
    it("declares both demo and background css classes on the host window", async () => {
        expect(cssShadowsDemo.windowCssClasses).toEqual(["demo", "background"]);
        await renderDemo(cssShadowsDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        expect(window).toHaveClass("demo");
        expect(window).toHaveClass("background");
    });

    it("loads the default CSS into a CssProvider when the editor mounts", async () => {
        const loaded = await findCssLoadedOnMount(cssShadowsDemo, "text-shadow");
        expect(loaded, "expected the default shadows CSS to be loaded via loadFromString").toBeDefined();
    });

    it("re-applies the CssProvider when the user edits the buffer", async () => {
        await expectCssReloadedOnEdit(
            cssShadowsDemo,
            "button { box-shadow: 0 0 10px red; }",
            "box-shadow: 0 0 10px red",
        );
    });
});

describe("cssShadowsDemo error tagging", () => {
    it("underlines invalid CSS with an error tag in the buffer", async () => {
        await renderDemo(cssShadowsDemo);
        const textView = await screen.findByName("text-view", { as: Gtk.TextView });
        await userEvent.clear(textView);

        await waitFor(() => {
            expect(hasBufferTag(textView, "error")).toBe(false);
        });

        await userEvent.type(textView, "button { nonsense-prop: 5px; }");

        await waitFor(() => {
            expect(hasBufferTag(textView, "error")).toBe(true);
        });
    });

    it("clears previously applied error tags once the buffer is edited to valid CSS", async () => {
        await renderDemo(cssShadowsDemo);
        const textView = await screen.findByName("text-view", { as: Gtk.TextView });
        await userEvent.clear(textView);
        await userEvent.type(textView, "button { nonsense-prop: 5px; }");

        await waitFor(() => {
            expect(hasBufferTag(textView, "error")).toBe(true);
        });

        await userEvent.clear(textView);
        await userEvent.type(textView, "button { color: red; }");

        await waitFor(() => {
            expect(hasBufferTag(textView, "error")).toBe(false);
        });
    });
});
