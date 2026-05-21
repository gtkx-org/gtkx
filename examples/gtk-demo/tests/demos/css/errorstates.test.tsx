import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { errorstatesDemo } from "../../../src/demos/css/errorstates.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

describe("errorstatesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(errorstatesDemo.id).toBe("errorstates");
        expect(errorstatesDemo.title).toBe("Error States");
        expect(errorstatesDemo.description.length).toBeGreaterThan(0);
        expect(errorstatesDemo.keywords).toEqual(
            expect.arrayContaining(["css", "error", "validation", "state", "entry", "switch", "scale"]),
        );
        expect(typeof errorstatesDemo.sourceCode).toBe("string");
        expect(errorstatesDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(errorstatesDemo.component).toBeTypeOf("function");
    });

    it("renders both entries, the scale and the switch in initial state", async () => {
        await renderDemo(errorstatesDemo);
        const entries = (await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry[];
        expect(entries).toHaveLength(2);
        const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER);
        expect(scale).toBeInstanceOf(Gtk.Scale);
        expect((scale as Gtk.Scale).getValue()).toBe(50);
        const sw = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
        expect(sw).toBeInstanceOf(Gtk.Switch);
        expect((sw as Gtk.Switch).getActive()).toBe(false);
        expect((sw as Gtk.Switch).getState()).toBe(false);
    });
});

describe("errorstatesDemo entries", () => {
    it("flags the more-details entry as invalid when filled while details is empty", async () => {
        await renderDemo(errorstatesDemo);
        const entries = (await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry[];
        const [detailsEntry, moreDetailsEntry] = entries;
        if (!detailsEntry || !moreDetailsEntry) throw new Error("expected both entries to be present");
        await act(() => moreDetailsEntry.setText("filled in"));
        await fireEvent(moreDetailsEntry, "changed");
        expect(moreDetailsEntry.hasCssClass("error")).toBe(true);
        expect(moreDetailsEntry.getTooltipText()).toBe("Must have details first");
    });

    it("clears the more-details error once the details entry receives input", async () => {
        await renderDemo(errorstatesDemo);
        const entries = (await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry[];
        const [detailsEntry, moreDetailsEntry] = entries;
        if (!detailsEntry || !moreDetailsEntry) throw new Error("expected both entries to be present");
        await act(() => moreDetailsEntry.setText("filled in"));
        await fireEvent(moreDetailsEntry, "changed");
        expect(moreDetailsEntry.hasCssClass("error")).toBe(true);
        await act(() => detailsEntry.setText("ok"));
        await fireEvent(detailsEntry, "changed");
        expect(moreDetailsEntry.hasCssClass("error")).toBe(false);
    });
});

describe("errorstatesDemo switch and scale", () => {
    it("shows the level-too-low error label when the switch is activated with the level low", async () => {
        const { container } = await renderDemo(errorstatesDemo);
        const sw = (await screen.findByRole(Gtk.AccessibleRole.SWITCH)) as Gtk.Switch;
        await act(() => sw.setActive(true));
        await fireEvent(sw, "state-set", true);
        const errorLabel = findLabelByText(container, "Level too low");
        expect(errorLabel).toBeInstanceOf(Gtk.Label);
        if (!errorLabel) return;
        expect(errorLabel.hasCssClass("error")).toBe(true);
    });

    it("does not show the error label when the switch is activated with a high level", async () => {
        const { container } = await renderDemo(errorstatesDemo);
        const scale = (await screen.findByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale;
        const sw = (await screen.findByRole(Gtk.AccessibleRole.SWITCH)) as Gtk.Switch;
        await act(() => scale.setValue(80));
        await fireEvent(scale, "value-changed");
        await act(() => sw.setActive(true));
        await fireEvent(sw, "state-set", true);
        expect(sw.getState()).toBe(true);
        expect(findLabelByText(container, "Level too low")).toBeNull();
    });

    it("flips the switch state automatically when the level crosses 50 with the switch already active", async () => {
        await renderDemo(errorstatesDemo);
        const scale = (await screen.findByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale;
        const sw = (await screen.findByRole(Gtk.AccessibleRole.SWITCH)) as Gtk.Switch;
        await act(() => sw.setActive(true));
        await fireEvent(sw, "state-set", true);
        await act(() => scale.setValue(80));
        await fireEvent(scale, "value-changed");
        expect(sw.getState()).toBe(true);
        await act(() => scale.setValue(20));
        await fireEvent(scale, "value-changed");
        expect(sw.getState()).toBe(false);
    });
});

const findLabelByText = (root: Gtk.Widget, text: string): Gtk.Label | null =>
    findAllOfType(root, Gtk.Label).find((label) => label.getLabel() === text) ?? null;
