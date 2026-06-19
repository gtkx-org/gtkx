import { AdwComboRow, AdwEntryRow, AdwPreferencesGroup, AdwSpinRow, AdwSwitchRow } from "@gtkx/jsx/adw";
import { GtkAdjustment } from "@gtkx/jsx/gtk";

export const Demo = () => {
    return (
        <AdwPreferencesGroup title="Editor" description="How notes are displayed and edited" hexpand>
            <AdwSwitchRow title="Spell Check" subtitle="Highlight spelling errors while typing" active />
            <AdwSpinRow
                title="Font Size"
                adjustment={<GtkAdjustment value={14} lower={8} upper={32} stepIncrement={1} />}
            />
            <AdwComboRow
                title="Sort Order"
                items={[
                    { id: "title", value: "By title" },
                    { id: "date", value: "By date" },
                ]}
                selectedId="date"
            />
            <AdwEntryRow title="Author" text="GTKX Contributors" />
        </AdwPreferencesGroup>
    );
};
