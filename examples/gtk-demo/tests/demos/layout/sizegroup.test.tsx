import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { sizegroupDemo } from "../../../src/demos/layout/sizegroup.js";
import { renderDemo } from "../../test-utils.js";

const MNEMONIC_LABELS = ["Foreground", "Background", "Dashing", "Line ends"] as const;

const naturalWidths = (dropdowns: Gtk.Widget[]): number[] =>
    dropdowns.map((d) => d.measure(Gtk.Orientation.HORIZONTAL, -1)[1]);

const areAllEqual = (values: number[]): boolean => values.every((v) => v === values[0]);

const renderDropDowns = async (): Promise<Gtk.Widget[]> => {
    await renderDemo(sizegroupDemo);

    return await screen.findAllByRole(Gtk.AccessibleRole.COMBO_BOX);
};

describe("sizegroupDemo frames and labels", () => {
    it("renders the Color Options and Line Options frames with their labels", async () => {
        await renderDemo(sizegroupDemo);
        const colorFrame = await screen.findByName("color-options-frame", { as: Gtk.Frame });
        const lineFrame = await screen.findByName("line-options-frame", { as: Gtk.Frame });
        expect(colorFrame).toHaveObjectProperty("label", "Color Options");
        expect(lineFrame).toHaveObjectProperty("label", "Line Options");
    });

    it("renders four GtkDropDowns - one per option row", async () => {
        const dropdowns = await renderDropDowns();
        expect(dropdowns).toHaveLength(4);
    });

    it(
        "renders the underline-mnemonic labels '_Foreground', '_Background', '_Dashing', '_Line ends' " +
        "linked to their dropdowns",
        async () => {
            const dropdowns = await renderDropDowns();

            for (const [index, text] of MNEMONIC_LABELS.entries()) {
                expect(await screen.findByLabelText(text)).toBe(dropdowns[index]);
            }
        },
    );
});

describe("sizegroupDemo check button", () => {
    it("starts with grouping enabled so every dropdown shares one requested width", async () => {
        await renderDemo(sizegroupDemo);
        await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Enable grouping", checked: true });
        const dropdowns = await screen.findAllByRole(Gtk.AccessibleRole.COMBO_BOX);
        const widths = naturalWidths(dropdowns);
        expect(widths.every((w) => w > 0)).toBe(true);
        expect(areAllEqual(widths)).toBe(true);
    });

    it("labels the check button '_Enable grouping'", async () => {
        await renderDemo(sizegroupDemo);
        const check = await screen.findByName("enable-grouping-check", { as: Gtk.CheckButton });
        expect(check).toHaveObjectProperty("label", "_Enable grouping");
    });

    it("toggling the check button off switches the size group to NONE, unequalising widths", async () => {
        const dropdowns = await renderDropDowns();
        const groupedWidths = naturalWidths(dropdowns);
        expect(areAllEqual(groupedWidths)).toBe(true);

        const check = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, {
            name: "Enable grouping",
            checked: true,
        });

        await userEvent.click(check);
        await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Enable grouping", checked: false });
        const ungroupedWidths = naturalWidths(dropdowns);
        expect(areAllEqual(ungroupedWidths)).toBe(false);
        expect(Math.max(...ungroupedWidths)).toBe(groupedWidths[0]);
        await userEvent.click(check);
        await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Enable grouping", checked: true });
        expect(areAllEqual(naturalWidths(dropdowns))).toBe(true);
    });
});

describe("sizegroupDemo dropdowns", () => {
    it("initialises each dropdown to the first option of its data set", async () => {
        const dropdowns = await renderDropDowns();
        expect(dropdowns).toHaveLength(4);

        for (const dropdown of dropdowns) {
            expect(dropdown).toHaveObjectProperty("selected", 0);
        }
    });

    it.each(MNEMONIC_LABELS)("changing the %s dropdown selection persists in the widget", async (label) => {
        await renderDemo(sizegroupDemo);
        const dropdown = await screen.findByLabelText(label, { as: Gtk.DropDown });
        expect(dropdown).toHaveObjectProperty("selected", 0);
        await userEvent.selectOptions(dropdown, 2);
        expect(dropdown).toHaveObjectProperty("selected", 2);
        await userEvent.selectOptions(dropdown, 1);
        expect(dropdown).toHaveObjectProperty("selected", 1);
    });
});
