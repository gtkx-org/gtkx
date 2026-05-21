import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { flowboxDemo } from "../../../src/demos/layout/flowbox.js";
import { renderDemo } from "../../helpers/render-demo.js";

const findAllOfType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T[] => {
    const matches: T[] = [];
    const visit = (widget: Gtk.Widget): void => {
        if (widget instanceof ctor) matches.push(widget);
        let child = widget.getFirstChild();
        while (child) {
            visit(child);
            child = child.getNextSibling();
        }
    };
    visit(root);
    return matches;
};

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
        expect(flowboxDemo.keywords).toEqual(
            expect.arrayContaining(["flowbox", "GtkFlowBox", "grid", "wrap", "responsive"]),
        );
    });

    it("ships a non-empty source-code string", () => {
        expect(typeof flowboxDemo.sourceCode).toBe("string");
        expect(flowboxDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
    });
});

describe("flowboxDemo container", () => {
    it("renders a GtkScrolledWindow with horizontal scrollbar disabled", async () => {
        if (!flowboxDemo.component) throw new Error("flowbox demo component missing");
        const { container } = await renderDemo(flowboxDemo.component);
        const scrolled = findAllOfType(container, Gtk.ScrolledWindow);
        expect(scrolled).toHaveLength(1);
        const sw = scrolled[0];
        if (!sw) throw new Error("expected scrolled window");
        const [hpolicy] = sw.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.NEVER);
    });

    it("renders a single GtkFlowBox configured with NONE selection and START valign", async () => {
        if (!flowboxDemo.component) throw new Error("flowbox demo component missing");
        const { container } = await renderDemo(flowboxDemo.component);
        const flowBoxes = findAllOfType(container, Gtk.FlowBox);
        expect(flowBoxes).toHaveLength(1);
        const flowBox = flowBoxes[0];
        if (!flowBox) throw new Error("expected GtkFlowBox");
        expect(flowBox.getSelectionMode()).toBe(Gtk.SelectionMode.NONE);
        expect(flowBox.getValign()).toBe(Gtk.Align.START);
        expect(flowBox.getMaxChildrenPerLine()).toBe(30);
    });
});

describe("flowboxDemo children", () => {
    it("renders one GtkButton per color in the dataset", async () => {
        if (!flowboxDemo.component) throw new Error("flowbox demo component missing");
        const { container } = await renderDemo(flowboxDemo.component);
        const buttons = findAllOfType(container, Gtk.Button);
        expect(buttons).toHaveLength(EXPECTED_COLOR_COUNT);
    });

    it("wraps each GtkButton with a 24x24 GtkDrawingArea", async () => {
        if (!flowboxDemo.component) throw new Error("flowbox demo component missing");
        const { container } = await renderDemo(flowboxDemo.component);
        const areas = findAllOfType(container, Gtk.DrawingArea);
        expect(areas).toHaveLength(EXPECTED_COLOR_COUNT);
        for (const area of areas) {
            expect(area.getContentWidth()).toBe(24);
            expect(area.getContentHeight()).toBe(24);
        }
    });

    it("creates a unique GtkFlowBoxChild for every color button", async () => {
        if (!flowboxDemo.component) throw new Error("flowbox demo component missing");
        const { container } = await renderDemo(flowboxDemo.component);
        const flowBoxChildren = findAllOfType(container, Gtk.FlowBoxChild);
        expect(flowBoxChildren).toHaveLength(EXPECTED_COLOR_COUNT);
    });
});

describe("flowboxDemo accessibility", () => {
    it("exposes the GtkFlowBox via the GRID accessible role", async () => {
        if (!flowboxDemo.component) throw new Error("flowbox demo component missing");
        await renderDemo(flowboxDemo.component);
        const grid = await screen.findByRole(Gtk.AccessibleRole.GRID);
        expect(grid).toBeInstanceOf(Gtk.FlowBox);
    });

    it("exposes every GtkFlowBoxChild via the GRID_CELL role", async () => {
        if (!flowboxDemo.component) throw new Error("flowbox demo component missing");
        await renderDemo(flowboxDemo.component);
        const cells = await screen.findAllByRole(Gtk.AccessibleRole.GRID_CELL);
        expect(cells).toHaveLength(EXPECTED_COLOR_COUNT);
    });
});
