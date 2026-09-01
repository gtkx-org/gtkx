import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssShadowsDemo } from "../../../src/demos/css/css-shadows.js";
import { renderDemo } from "../../test-utils.js";

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
});
