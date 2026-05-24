import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
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

    it("ships a non-empty source-code string", () => {
        expect(typeof flowboxDemo.sourceCode).toBe("string");
        expect(flowboxDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
    });
});

describe("flowboxDemo container", () => {
    it("renders a GtkScrolledWindow with horizontal scrollbar disabled", async () => {
        await renderDemo(flowboxDemo);
        const sw = (await screen.findByName("scrolled")) as Gtk.ScrolledWindow;
        const [hpolicy] = sw.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.NEVER);
    });

    it("renders a single GtkFlowBox configured with NONE selection and START valign", async () => {
        await renderDemo(flowboxDemo);
        const flowBox = (await screen.findByName("flow-box")) as Gtk.FlowBox;
        expect(flowBox.getSelectionMode()).toBe(Gtk.SelectionMode.NONE);
        expect(flowBox.getValign()).toBe(Gtk.Align.START);
        expect(flowBox.getMaxChildrenPerLine()).toBe(30);
    });
});

describe("flowboxDemo children", () => {
    it("renders one GtkButton per color in the dataset", async () => {
        await renderDemo(flowboxDemo);
        const buttons = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON);
        expect(buttons).toHaveLength(EXPECTED_COLOR_COUNT);
        for (const button of buttons) {
            expect(button).toBeInstanceOf(Gtk.Button);
        }
    });

    it("creates a unique GtkFlowBoxChild for every color button", async () => {
        await renderDemo(flowboxDemo);
        const cells = await screen.findAllByRole(Gtk.AccessibleRole.GRID_CELL);
        expect(cells).toHaveLength(EXPECTED_COLOR_COUNT);
        for (const cell of cells) {
            expect(cell).toBeInstanceOf(Gtk.FlowBoxChild);
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
