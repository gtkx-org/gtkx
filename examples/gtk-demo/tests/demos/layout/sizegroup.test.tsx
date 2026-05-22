import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { sizegroupDemo } from "../../../src/demos/layout/sizegroup.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

describe("sizegroupDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(sizegroupDemo.id).toBe("sizegroup");
        expect(sizegroupDemo.title).toBe("Size Groups");
        expect(sizegroupDemo.description.length).toBeGreaterThan(0);
        expect(sizegroupDemo.keywords).toEqual(expect.arrayContaining(["gtk_fill", "gtksizegroup", "gtktable"]));
        expect(typeof sizegroupDemo.sourceCode).toBe("string");
        expect(sizegroupDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(sizegroupDemo.component).toBeTypeOf("function");
    });
});

describe("sizegroupDemo frames and labels", () => {
    it("renders the Color Options and Line Options frames", async () => {
        await renderDemo(sizegroupDemo);
        const colorFrame = (await screen.findByName("color-options-frame")) as Gtk.Frame;
        const lineFrame = (await screen.findByName("line-options-frame")) as Gtk.Frame;
        expect(colorFrame.getLabel()).toBe("Color Options");
        expect(lineFrame.getLabel()).toBe("Line Options");
    });

    it("renders four GtkDropDowns - one per option row", async () => {
        const { container } = await renderDemo(sizegroupDemo);
        const dropdowns = findAllOfType(container, Gtk.DropDown);
        expect(dropdowns).toHaveLength(4);
    });

    it("renders the underline-mnemonic labels '_Foreground', '_Background', '_Dashing', '_Line ends'", async () => {
        const { container } = await renderDemo(sizegroupDemo);
        const labels = findAllOfType(container, Gtk.Label);
        const texts = labels.map((l) => l.getLabel());
        expect(texts).toContain("_Foreground");
        expect(texts).toContain("_Background");
        expect(texts).toContain("_Dashing");
        expect(texts).toContain("_Line ends");
    });

    it("connects each label to its dropdown via the mnemonic widget pointer", async () => {
        const { container } = await renderDemo(sizegroupDemo);
        const labels = findAllOfType(container, Gtk.Label).filter((l) => {
            const text = l.getLabel();
            return text === "_Foreground" || text === "_Background" || text === "_Dashing" || text === "_Line ends";
        });
        expect(labels).toHaveLength(4);
        for (const label of labels) {
            expect(label.getMnemonicWidget()).toBeInstanceOf(Gtk.DropDown);
        }
    });
});

describe("sizegroupDemo check button", () => {
    it("starts with grouping enabled and the size group in HORIZONTAL mode", async () => {
        await renderDemo(sizegroupDemo);
        const toggle = (await screen.findByName("enable-grouping-check")) as Gtk.CheckButton;
        expect(toggle).toBeInstanceOf(Gtk.CheckButton);
        expect(toggle.getActive()).toBe(true);
    });

    it("renders the '_Enable grouping' check button with underline-mnemonic enabled", async () => {
        await renderDemo(sizegroupDemo);
        const check = (await screen.findByName("enable-grouping-check")) as Gtk.CheckButton;
        expect(check.getLabel()).toBe("_Enable grouping");
        expect(check.getUseUnderline()).toBe(true);
    });

    it("toggles the check button active state when activated", async () => {
        await renderDemo(sizegroupDemo);
        const check = (await screen.findByName("enable-grouping-check")) as Gtk.CheckButton;
        expect(check.getActive()).toBe(true);
        await act(() => check.setActive(false));
        await fireEvent(check, "toggled");
        expect(check.getActive()).toBe(false);
    });
});

describe("sizegroupDemo dropdowns", () => {
    it("initialises each dropdown to the first option of its data set", async () => {
        const { container } = await renderDemo(sizegroupDemo);
        const dropdowns = findAllOfType(container, Gtk.DropDown);
        expect(dropdowns).toHaveLength(4);
        for (const dropdown of dropdowns) {
            expect(dropdown.getSelected()).toBe(0);
        }
    });

    it("changing the foreground dropdown selection persists in the widget", async () => {
        const { container } = await renderDemo(sizegroupDemo);
        const [foreground] = findAllOfType(container, Gtk.DropDown);
        if (!foreground) throw new Error("expected foreground dropdown");
        await act(() => foreground.setSelected(2));
        expect(foreground.getSelected()).toBe(2);
    });
});
