import * as Gtk from "@gtkx/ffi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { cssAccordionDemo } from "../../../src/demos/css/css-accordion.js";
import { renderDemo } from "../../test-utils.js";

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
        expect(frame.getCssClasses()).toContain("accordion");
    });

    it("centers the horizontal button box without spacing", async () => {
        await renderDemo(cssAccordionDemo);
        const box = (await screen.findByName("button-box")) as Gtk.Box;
        expect(box).toBeInstanceOf(Gtk.Box);
        expect(box.getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
        expect(box.getHalign()).toBe(Gtk.Align.CENTER);
        expect(box.getValign()).toBe(Gtk.Align.CENTER);
        expect(box.getSpacing()).toBe(0);
    });

    it("registers a CssProvider on the default display at application priority", async () => {
        const addSpy = vi.spyOn(Gtk.StyleContext, "addProviderForDisplay");
        try {
            await renderDemo(cssAccordionDemo);
            const applicationCalls = addSpy.mock.calls.filter(
                ([, , priority]) => priority === Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
            );
            expect(
                applicationCalls.length,
                "expected the accordion demo to add a provider at STYLE_PROVIDER_PRIORITY_APPLICATION",
            ).toBeGreaterThan(0);
            expect(applicationCalls.every(([, provider]) => provider instanceof Gtk.CssProvider)).toBe(true);
        } finally {
            addSpy.mockRestore();
        }
    });

    it("fires the clicked signal when an accordion button is activated", async () => {
        await renderDemo(cssAccordionDemo);
        const button = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "This" })) as Gtk.Button;
        const clickHandler = vi.fn();
        const handlerId = button.connect("clicked", clickHandler);
        try {
            await userEvent.click(button);
            await waitFor(() => expect(clickHandler).toHaveBeenCalled());
        } finally {
            button.disconnect(handlerId);
        }
    });
});
