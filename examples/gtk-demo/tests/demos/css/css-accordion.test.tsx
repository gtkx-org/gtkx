import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { cssAccordionDemo } from "../../../src/demos/css/css-accordion.js";
import { renderDemo, screen } from "../../test-utils.js";

describe("cssAccordionDemo", () => {
    it("exposes the expected metadata", () => {
        expect(cssAccordionDemo.id).toBe("css-accordion");
        expect(cssAccordionDemo.title).toBe("Theming/CSS Accordion");
        expect(cssAccordionDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(cssAccordionDemo.keywords)).toBe(true);
        expect(typeof cssAccordionDemo.sourceCode).toBe("string");
        expect(cssAccordionDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(cssAccordionDemo.defaultWidth).toBe(600);
        expect(cssAccordionDemo.defaultHeight).toBe(300);
        expect(cssAccordionDemo.component).toBeTypeOf("function");
    });

    it("renders six accordion buttons with the expected labels", async () => {
        await renderDemo(cssAccordionDemo);
        const labels = ["This", "Is", "A", "CSS", "Accordion", ":-)"];
        for (const label of labels) {
            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label });
            expect(button).toBeInstanceOf(Gtk.Button);
        }
    });

    it("wraps the buttons in a frame with the accordion css class applied", async () => {
        await renderDemo(cssAccordionDemo);
        const frame = (await screen.findByName("frame")) as Gtk.Frame;
        expect(frame).toBeInstanceOf(Gtk.Frame);
        const classes = frame.getCssClasses();
        expect(classes.length).toBeGreaterThan(0);
        expect(classes.some((c) => c.length > 0)).toBe(true);
    });

    it("centers the horizontal button box without spacing", async () => {
        await renderDemo(cssAccordionDemo);
        const button = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "This" })) as Gtk.Button;
        const box = button.getParent() as Gtk.Box;
        expect(box).toBeInstanceOf(Gtk.Box);
        expect(box.getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
        expect(box.getHalign()).toBe(Gtk.Align.CENTER);
        expect(box.getValign()).toBe(Gtk.Align.CENTER);
        expect(box.getSpacing()).toBe(0);
    });
});
