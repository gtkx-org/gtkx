import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssAccordionDemo } from "../../../src/demos/css/css-accordion.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findFirstOfType } from "../../helpers/traverse.js";

describe("cssAccordionDemo", () => {
    it("exposes the expected metadata", () => {
        expect(cssAccordionDemo.id).toBe("css-accordion");
        expect(cssAccordionDemo.title).toBe("Theming/CSS Accordion");
        expect(cssAccordionDemo.description.length).toBeGreaterThan(0);
        expect(cssAccordionDemo.keywords).toEqual(
            expect.arrayContaining(["css", "transition", "animation", "accordion", "hover"]),
        );
        expect(typeof cssAccordionDemo.sourceCode).toBe("string");
        expect(cssAccordionDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(cssAccordionDemo.defaultWidth).toBe(600);
        expect(cssAccordionDemo.defaultHeight).toBe(300);
        expect(cssAccordionDemo.component).toBeTypeOf("function");
    });

    it("renders six accordion buttons with the expected labels", async () => {
        if (!cssAccordionDemo.component) throw new Error("css-accordion demo component missing");
        await renderDemo(cssAccordionDemo.component);
        const labels = ["This", "Is", "A", "CSS", "Accordion", ":-)"];
        for (const label of labels) {
            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label });
            expect(button).toBeInstanceOf(Gtk.Button);
        }
    });

    it("wraps the buttons in a frame with the accordion css class applied", async () => {
        if (!cssAccordionDemo.component) throw new Error("css-accordion demo component missing");
        const { container } = await renderDemo(cssAccordionDemo.component);
        const frame = findFirstOfType(container, Gtk.Frame);
        expect(frame).toBeInstanceOf(Gtk.Frame);
        if (!frame) return;
        const classes = frame.getCssClasses();
        expect(classes.length).toBeGreaterThan(0);
        expect(classes.some((c) => c.length > 0)).toBe(true);
    });

    it("centers the horizontal button box without spacing", async () => {
        if (!cssAccordionDemo.component) throw new Error("css-accordion demo component missing");
        const { container } = await renderDemo(cssAccordionDemo.component);
        const button = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "This" })) as Gtk.Button;
        const box = button.getParent() as Gtk.Box;
        expect(box).toBeInstanceOf(Gtk.Box);
        expect(box.getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
        expect(box.getHalign()).toBe(Gtk.Align.CENTER);
        expect(box.getValign()).toBe(Gtk.Align.CENTER);
        expect(box.getSpacing()).toBe(0);
        expect(container).toBeDefined();
    });
});
