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

    it("renders the CSS editor with the default shadow styles", async () => {
        await renderDemo(cssShadowsDemo);
        const textView = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, {
            name: "CSS editor",
            as: Gtk.TextView,
        });
        expect(textView).toHaveDisplayValue(/window\.demo\.background/);
        expect(textView).toHaveDisplayValue(/text-shadow/);
    });
});

describe("cssShadowsDemo behavior", () => {
    it("applies the demo and background classes to the host window", async () => {
        await renderDemo(cssShadowsDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        expect(window).toHaveClass("demo");
        expect(window).toHaveClass("background");
    });
});
