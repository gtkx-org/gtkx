import type { ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwComboRow, AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkDropDown, GtkLabel, GtkStringList } from "@gtkx/jsx/gtk";
import { render, userEvent, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { itemFactory } from "../helpers/list-view-render.js";

type ComboFixtureProps = {
    strings?: string[];
    accessibleValueText?: string;
    selected?: number;
    useSubtitle?: boolean;
};

const ComboFixture = ({
    strings,
    accessibleValueText,
    selected = 0,
    useSubtitle = false,
}: ComboFixtureProps): ReactNode => (
    <AdwPreferencesGroup>
        <AdwComboRow
            title="Choose a value"
            subtitle={useSubtitle ? undefined : "Row description"}
            prefix={<GtkLabel>Prefix</GtkLabel>}
            suffix={<GtkLabel>Suffix</GtkLabel>}
            accessibleValueText={accessibleValueText}
            model={strings === undefined ? undefined : <GtkStringList strings={strings} />}
            factory={itemFactory()}
            selected={selected}
            useSubtitle={useSubtitle}
        />
    </AdwPreferencesGroup>
);

describe("combo box display values", () => {
    it.each(["", "Spoken choice"])("reads selected content independently of value %j", async (accessibleValueText) => {
        const { container } = await render(
            <ComboFixture
                strings={["Displayed selection", "Other choice"]}
                accessibleValueText={accessibleValueText}
            />,
        );
        const scope = within(container);
        const row = scope.getByRole(Gtk.AccessibleRole.COMBO_BOX, { as: Adw.ComboRow });

        expect(scope.getByText("Displayed selection")).toBeVisible();
        expect(row).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_TEXT, accessibleValueText);
        expect(row).toHaveDisplayValue("Displayed selection");
        expect(scope.getByDisplayValue("Displayed selection")).toBe(row);
        expect(scope.getByDisplayValue(/Displayed/)).toBe(row);
        expect(() => scope.getByDisplayValue("Choose a value")).toThrow();
        expect(() => scope.getByDisplayValue(accessibleValueText)).toThrow();
        expect(() => {
            expect(row).toHaveDisplayValue("Other choice");
        }).toThrow();

        await userEvent.click(row);
        expect(await scope.findByText("Other choice")).toBeVisible();
        expect(row).toHaveDisplayValue("Displayed selection");
        expect(scope.queryByDisplayValue("Other choice")).toBeNull();
    });

    it("matches an empty displayed label without substituting its accessible value", async () => {
        const { container } = await render(<ComboFixture strings={[""]} accessibleValueText="Spoken choice" />);
        const scope = within(container);
        const row = scope.getByRole(Gtk.AccessibleRole.COMBO_BOX);

        expect(row).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_TEXT, "Spoken choice");
        expect(row).toHaveDisplayValue("");
        expect(row).not.toHaveDisplayValue();
        expect(scope.getByDisplayValue("")).toBe(row);
        expect(scope.queryByDisplayValue("Spoken choice")).toBeNull();
    });

    it.each([
        { strings: [] },
        {},
        { strings: [], useSubtitle: true },
        { useSubtitle: true },
    ])("matches an empty row with source %j", async (props) => {
        const { container } = await render(<ComboFixture {...props} />);
        const scope = within(container);
        const row = scope.getByRole(Gtk.AccessibleRole.COMBO_BOX);

        expect(row).toHaveDisplayValue("");
        expect(row).not.toHaveDisplayValue();
        expect(scope.getByDisplayValue("")).toBe(row);
        expect(scope.queryByDisplayValue("Row description")).toBeNull();
        expect(scope.queryByDisplayValue("Prefix")).toBeNull();
        expect(scope.queryByDisplayValue("Suffix")).toBeNull();
    });

    it("reads the displayed subtitle independently of an accessible override", async () => {
        const { container } = await render(
            <ComboFixture strings={["Subtitle choice"]} accessibleValueText="Spoken choice" useSubtitle />,
        );
        const scope = within(container);
        const row = scope.getByRole(Gtk.AccessibleRole.COMBO_BOX);

        expect(scope.getByText("Subtitle choice")).toBeVisible();
        expect(row).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_TEXT, "Spoken choice");
        expect(row).toHaveDisplayValue("Subtitle choice");
        expect(scope.getByDisplayValue("Subtitle choice")).toBe(row);
        expect(scope.queryByDisplayValue("Spoken choice")).toBeNull();
    });

    it("updates display queries when selection changes", async () => {
        const strings = ["First", "Second"];
        const { container, rerender } = await render(<ComboFixture strings={strings} />);
        const scope = within(container);
        const row = scope.getByDisplayValue("First");
        await rerender(<ComboFixture strings={strings} selected={1} />);

        expect(row).toHaveDisplayValue("Second");
        expect(scope.getByDisplayValue("Second")).toBe(row);
        expect(scope.queryByDisplayValue("First")).toBeNull();
    });

    it("preserves the displayed selection of a GtkDropDown with an accessible override", async () => {
        const { container } = await render(
            <GtkDropDown
                model={<GtkStringList strings={["Displayed selection"]} />}
                factory={itemFactory()}
                accessibleValueText="Spoken choice"
            />,
        );
        const scope = within(container);
        const dropdown = scope.getByRole(Gtk.AccessibleRole.COMBO_BOX);

        expect(dropdown).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_TEXT, "Spoken choice");
        expect(dropdown).toHaveDisplayValue("Displayed selection");
        expect(scope.getByDisplayValue("Displayed selection")).toBe(dropdown);
    });
});
