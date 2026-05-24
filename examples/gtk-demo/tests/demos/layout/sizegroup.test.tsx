import * as Gtk from "@gtkx/ffi/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { sizegroupDemo } from "../../../src/demos/layout/sizegroup.js";
import { renderDemo } from "../../test-utils.js";

const MNEMONIC_LABELS = ["_Foreground", "_Background", "_Dashing", "_Line ends"] as const;

describe("sizegroupDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(sizegroupDemo.id).toBe("sizegroup");
        expect(sizegroupDemo.title).toBe("Size Groups");
        expect(sizegroupDemo.description.length).toBeGreaterThan(0);
        expect(sizegroupDemo.keywords).toEqual([]);
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
        await renderDemo(sizegroupDemo);
        const dropdowns = await screen.findAllByRole(Gtk.AccessibleRole.COMBO_BOX);
        expect(dropdowns).toHaveLength(4);
    });

    it("renders the underline-mnemonic labels '_Foreground', '_Background', '_Dashing', '_Line ends' linked to their dropdowns", async () => {
        await renderDemo(sizegroupDemo);
        for (const text of MNEMONIC_LABELS) {
            const target = await screen.findByLabelText(text);
            expect(target).toBeInstanceOf(Gtk.DropDown);
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

    it("toggles the check button active state when clicked", async () => {
        await renderDemo(sizegroupDemo);
        const check = (await screen.findByName("enable-grouping-check")) as Gtk.CheckButton;
        expect(check.getActive()).toBe(true);
        await userEvent.click(check);
        expect(check.getActive()).toBe(false);
    });
});

describe("sizegroupDemo dropdowns", () => {
    it("initialises each dropdown to the first option of its data set", async () => {
        await renderDemo(sizegroupDemo);
        const dropdowns = await screen.findAllByRole(Gtk.AccessibleRole.COMBO_BOX);
        expect(dropdowns).toHaveLength(4);
        for (const dropdown of dropdowns) {
            expect((dropdown as Gtk.DropDown).getSelected()).toBe(0);
        }
    });

    it("changing the foreground dropdown selection persists in the widget", async () => {
        await renderDemo(sizegroupDemo);
        const foreground = (await screen.findByLabelText("_Foreground")) as Gtk.DropDown;
        expect(foreground).toBeInstanceOf(Gtk.DropDown);
        await userEvent.selectOptions(foreground, 2);
        expect(foreground.getSelected()).toBe(2);
    });
});
