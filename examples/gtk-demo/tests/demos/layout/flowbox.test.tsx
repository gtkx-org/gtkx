import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { flowboxDemo } from "../../../src/demos/layout/flowbox.js";
import { renderDemo } from "../../test-utils.js";

const EXPECTED_COLOR_COUNT = 665;

describe("flowboxDemo metadata", () => {
    it("exposes the documented id, title and dimensions", () => {
        expect(flowboxDemo.id).toBe("flowbox");
        expect(flowboxDemo.title).toBe("Flow Box");
        expect(flowboxDemo.defaultWidth).toBe(400);
        expect(flowboxDemo.defaultHeight).toBe(600);
        expect(flowboxDemo.component).toBeTypeOf("function");
    });

    it("includes the dataset-size claim in the description and the expected keywords", () => {
        expect(flowboxDemo.description).toContain("665 colors");
        expect(flowboxDemo.keywords).toEqual([]);
    });

    it("ships source code containing the flow box and swatch-drawing markers", () => {
        expect(typeof flowboxDemo.sourceCode).toBe("string");
        expect(flowboxDemo.sourceCode).toContain("GtkFlowBox");
        expect(flowboxDemo.sourceCode).toContain("drawColor");
    });
});

describe("flowboxDemo container", () => {
    it("disables only the horizontal scrollbar on the GtkScrolledWindow", async () => {
        await renderDemo(flowboxDemo);
        const sw = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        const [hpolicy, vpolicy] = sw.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.NEVER);
        expect(vpolicy).not.toBe(Gtk.PolicyType.NEVER);
    });

    it("keeps the NONE-selection flow box unselectable when a swatch is clicked", async () => {
        await renderDemo(flowboxDemo);
        const flowBox = await screen.findByName("flow-box", { as: Gtk.FlowBox });
        expect(flowBox).toHaveObjectProperty("selectionMode", Gtk.SelectionMode.NONE);
        expect(flowBox).toHaveObjectProperty("valign", Gtk.Align.START);
        expect(flowBox).toHaveObjectProperty("maxChildrenPerLine", 30);
        const [firstButton] = within(flowBox).getAllByRole(Gtk.AccessibleRole.BUTTON);

        if (!firstButton) {
            throw new Error("expected at least one flowbox button");
        }

        await userEvent.click(firstButton);
        expect(flowBox.getSelectedChildren()).toHaveLength(0);
    });
});

describe("flowboxDemo children", () => {
    it("gives each color button a 24x24 GtkDrawingArea swatch", async () => {
        await renderDemo(flowboxDemo);
        const flowBox = await screen.findByName("flow-box");
        const buttons = within(flowBox).getAllByRole(Gtk.AccessibleRole.BUTTON, { as: Gtk.Button });
        expect(buttons).toHaveLength(EXPECTED_COLOR_COUNT);

        for (const button of buttons) {
            const swatch = button.getChild();
            expect(swatch).toBeInstanceOf(Gtk.DrawingArea);
            expect(swatch).toHaveObjectProperty("contentWidth", 24);
            expect(swatch).toHaveObjectProperty("contentHeight", 24);
        }
    });

    it("wraps every color button in its own GtkFlowBoxChild grid cell", async () => {
        await renderDemo(flowboxDemo);
        const flowBox = await screen.findByName("flow-box");
        const cells = within(flowBox).getAllByRole(Gtk.AccessibleRole.GRID_CELL);
        expect(cells).toHaveLength(EXPECTED_COLOR_COUNT);

        for (const cell of cells) {
            expect(within(cell).getByRole(Gtk.AccessibleRole.BUTTON)).toBeInstanceOf(Gtk.Button);
        }
    });
});

describe("flowboxDemo accessibility", () => {
    it("exposes the GtkFlowBox via the GRID accessible role", async () => {
        await renderDemo(flowboxDemo);
        const grid = await screen.findByRole(Gtk.AccessibleRole.GRID);
        expect(grid).toBeInstanceOf(Gtk.FlowBox);
    });
});
