import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { cssAccordionDemo } from "../../../src/demos/css/css-accordion.js";
import { renderDemo } from "../../test-utils.js";

const ACCORDION_LABELS = ["This", "Is", "A", "CSS", "Accordion", ":-)"];

describe("cssAccordionDemo", () => {
    it("renders six accordion buttons with the expected labels", async () => {
        await renderDemo(cssAccordionDemo);

        for (const label of ACCORDION_LABELS) {
            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label, as: Gtk.Button });
            expect(button).toHaveObjectProperty("label", label);
        }
    });

    it("wraps the buttons in a frame with the accordion css class applied", async () => {
        await renderDemo(cssAccordionDemo);
        const frame = await screen.findByName("frame", { as: Gtk.Frame });
        expect(frame).toHaveClass("accordion");
    });
});
