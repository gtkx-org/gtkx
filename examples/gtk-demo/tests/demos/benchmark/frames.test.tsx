import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { framesDemo } from "../../../src/demos/benchmark/frames.js";
import { renderDemo } from "../../test-utils.js";

describe("framesDemo", () => {
    it("exposes the expected metadata", () => {
        expect(framesDemo.id).toBe("frames");
        expect(framesDemo.title).toBe("Benchmark/Frames");
        expect(framesDemo.defaultWidth).toBe(600);
        expect(framesDemo.defaultHeight).toBe(400);
        expect(typeof framesDemo.sourceCode).toBe("string");
    });

    it("renders the fps label in the header bar driven by shared state", async () => {
        await renderDemo(framesDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        const titlebar = window.getTitlebar();
        expect(titlebar).toBeInstanceOf(Gtk.HeaderBar);
        const fpsContainer = await screen.findByText(/^[0-9]+\.[0-9]{2} fps$/);
        expect(fpsContainer).toBeDefined();
    });

    it("renders the snapshot color widget in the body", async () => {
        await renderDemo(framesDemo);
        const colorWidget = await screen.findByName("color-widget");
        expect(colorWidget).toBeInstanceOf(Gtk.Widget);
        expect(colorWidget.getHexpand()).toBe(true);
        expect(colorWidget.getVexpand()).toBe(true);
    });

    it("resizes the host window to 600x400 when mounted", async () => {
        await renderDemo(framesDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        const [width, height] = window.getDefaultSize();
        expect(width).toBe(600);
        expect(height).toBe(400);
    });
});
