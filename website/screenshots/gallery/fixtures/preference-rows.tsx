import { AdwComboRow, AdwEntryRow, AdwPreferencesGroup, AdwSpinRow, AdwSwitchRow } from "@gtkx/jsx/adw";
import { useAdjustment } from "@gtkx/react";

export const Demo = () => {
    const fontSizeAdjustment = useAdjustment({ value: 14, lower: 8, upper: 32, stepIncrement: 1 });

    return (
        <AdwPreferencesGroup title="Editor" description="How notes are displayed and edited" hexpand>
            <AdwSwitchRow title="Spell Check" subtitle="Highlight spelling errors while typing" active />
            <AdwSpinRow title="Font Size" adjustment={fontSizeAdjustment} />
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
