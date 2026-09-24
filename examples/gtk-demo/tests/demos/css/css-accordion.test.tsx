import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkFrame } from "@gtkx/jsx/gtk";
import { screen, screenshot } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import type { Demo } from "../../../src/demos/types.js";
import { cssAccordionDemo } from "../../../src/demos/css/css-accordion.js";
import { renderDemo } from "../../test-utils.js";

const ACCORDION_LABELS = ["This", "Is", "A", "CSS", "Accordion", ":-)"];

const AccordionProbe = () => (
    <GtkFrame cssClasses={["accordion"]}>
        <GtkBox>
            <GtkButton label="This" />
        </GtkBox>
    </GtkFrame>
);

const accordionProbeDemo: Demo = {
    id: "css-accordion-probe",
    title: "Accordion Probe",
    description: "",
    keywords: [],
    component: AccordionProbe,
    defaultWidth: 600,
    defaultHeight: 300,
};

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

    it("applies its styles in Strict Mode and removes them when closed", async () => {
        const baselineRender = await renderDemo(accordionProbeDemo);
        const baseline = await screenshot(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "This" }));
        await baselineRender.unmount();

        const styledRender = await renderDemo(cssAccordionDemo, { isReactStrictMode: true });
        const styled = await screenshot(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "This" }));
        expect(styled.data).not.toBe(baseline.data);
        await styledRender.unmount();

        await renderDemo(accordionProbeDemo);
        const reopened = await screenshot(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "This" }));
        expect(reopened.data).toBe(baseline.data);
    });
});
