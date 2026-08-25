import type { ReactNode } from "react";
import { ComboRow, EntryRow, PasswordEntryRow, SpinRow, SwitchRow } from "@gtkx/forms";
import { AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkAdjustment } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

type ErrorCase = {
    name: string;
    row: () => ReactNode;
};

const ERROR_CASES: ErrorCase[] = [
    { name: "EntryRow", row: () => <EntryRow name="value" title="Value" /> },
    { name: "PasswordEntryRow", row: () => <PasswordEntryRow name="value" title="Value" /> },
    { name: "SwitchRow", row: () => <SwitchRow name="value" title="Value" /> },
    {
        name: "SpinRow",
        row: () => (
            <SpinRow
                name="value"
                title="Value"
                adjustment={<GtkAdjustment lower={0} upper={10} stepIncrement={1} pageIncrement={1} />}
            />
        ),
    },
    {
        name: "ComboRow",
        row: () => <ComboRow name="value" title="Value" items={[{ id: "one", value: "One" }]} />,
    },
];

describe("forms - error paths", () => {
    it.each(ERROR_CASES)("throws when $name has neither a provider nor explicit control", async ({ row }) => {
        await expect(render(<AdwPreferencesGroup>{row()}</AdwPreferencesGroup>)).rejects.toThrow();
    });
});
