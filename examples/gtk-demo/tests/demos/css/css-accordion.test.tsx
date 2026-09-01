import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { cssAccordionDemo } from "../../../src/demos/css/css-accordion.js";
import { getChildren, renderDemo } from "../../test-utils.js";

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

    it("holds exactly the six accordion buttons as the button box children in order", async () => {
        await renderDemo(cssAccordionDemo);
        const box = await screen.findByName("button-box", { as: Gtk.Box });
        const children = getChildren(box);
        expect(children).toHaveLength(6);
        expect(children.every((child) => child instanceof Gtk.Button)).toBe(true);
        expect(children.map((child) => (child as Gtk.Button).getLabel())).toEqual(ACCORDION_LABELS);
    });
});

describe("cssAccordionDemo styling and interaction", () => {
    it("registers exactly one CssProvider on the default display at application priority", async () => {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const addSpy = vi.spyOn(Gtk.StyleContext, "addProviderForDisplay");

        try {
            await renderDemo(cssAccordionDemo);

            const applicationCalls = addSpy.mock.calls.filter(
                (call) => call[2] === Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
            );

            expect(applicationCalls).toHaveLength(1);
            expect(applicationCalls[0]?.[0]).toBe(Gdk.DisplayManager.get().getDefaultDisplay());
            expect(applicationCalls[0]?.[1]).toBeInstanceOf(Gtk.CssProvider);
        } finally {
            addSpy.mockRestore();
        }
    });
});
