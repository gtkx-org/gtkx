import * as Gtk from "@gtkx/gi/gtk";
import { screen, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { fixed2Demo } from "../../../src/demos/layout/fixed2.js";
import { renderDemo } from "../../test-utils.js";

const renderFixed = async (): Promise<Gtk.Fixed> => {
    await renderDemo(fixed2Demo);

    return await screen.findByName("fixed", { as: Gtk.Fixed });
};

describe("fixed2Demo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(fixed2Demo.id).toBe("fixed2");
        expect(fixed2Demo.title).toBe("Fixed Layout / Transformations");
        expect(fixed2Demo.description).toContain("rotate and scale a child widget using a transform");
        expect(fixed2Demo.keywords).toEqual(["GtkLayoutManager"]);
        expect(fixed2Demo.sourceCode).toContain("const fixed2Demo: Demo = {");
        expect(fixed2Demo.defaultWidth).toBe(400);
        expect(fixed2Demo.defaultHeight).toBe(300);
        expect(fixed2Demo.component).toBeTypeOf("function");
    });
});

describe("fixed2Demo structure", () => {
    it("renders the 'All fixed?' label inside the GtkFixed container", async () => {
        const fixed = await renderFixed();

        expect(within(fixed).getByRole(Gtk.AccessibleRole.LABEL, { name: "All fixed?" })).toHaveTextContent(
            "All fixed?",
        );
    });

    it("nests the GtkFixed inside a hexpand+vexpand GtkScrolledWindow", async () => {
        await renderDemo(fixed2Demo);
        const sw = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        expect(sw).toHaveObjectProperty("hexpand", true);
        expect(sw).toHaveObjectProperty("vexpand", true);
        const fixed = await screen.findByName("fixed");
        expect(within(sw).getByName("fixed")).toBe(fixed);
    });
});

describe("fixed2Demo configuration", () => {
    it("configures the GtkFixed with visible overflow and expand flags", async () => {
        const fixed = await renderFixed();
        expect(fixed).toHaveObjectProperty("overflow", Gtk.Overflow.VISIBLE);
        expect(fixed).toHaveObjectProperty("hexpand", true);
        expect(fixed).toHaveObjectProperty("vexpand", true);
    });

    it("renders exactly one fixed-label widget inside the GtkFixed", async () => {
        const fixed = await renderFixed();
        expect(within(fixed).getAllByName("fixed-label")).toHaveLength(1);
    });
});

describe("fixed2Demo animation tick", () => {
    it("mutates the label's child transform as the frame clock advances", async () => {
        const fixed = await renderFixed();
        const label = within(fixed).getByName("fixed-label", { as: Gtk.Label });
        const first = fixed.getChildTransform(label);
        expect(first).not.toBeNull();

        await waitFor(() => {
            expect(first?.equal(fixed.getChildTransform(label))).toBe(false);
        });
    });
});
