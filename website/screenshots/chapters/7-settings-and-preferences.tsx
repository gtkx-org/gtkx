import { AdwPreferencesGroup, AdwPreferencesPage, AdwPreferencesWindow, AdwSpinRow, AdwSwitchRow } from "@gtkx/jsx/adw";
import { useAdjustment } from "@gtkx/react";

export const Chapter7 = () => {
    const fontSizeAdjustment = useAdjustment({ value: 14, lower: 8, upper: 32, stepIncrement: 1 });

    return (
        <AdwPreferencesWindow title="Preferences" defaultWidth={500} defaultHeight={400}>
            <AdwPreferencesPage title="General" iconName="preferences-system-symbolic">
                <AdwPreferencesGroup title="Appearance">
                    <AdwSwitchRow title="Compact Mode" subtitle="Use smaller spacing in the note list" />
                </AdwPreferencesGroup>
                <AdwPreferencesGroup title="Editor">
                    <AdwSwitchRow title="Spell Check" subtitle="Highlight spelling errors while typing" active />
                    <AdwSpinRow
                        title="Font Size"
                        subtitle="Base font size for the editor"
                        adjustment={fontSizeAdjustment}
                    />
                </AdwPreferencesGroup>
            </AdwPreferencesPage>
        </AdwPreferencesWindow>
    );
};
