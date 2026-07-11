import { AdwPreferencesGroup, AdwPreferencesPage, AdwPreferencesWindow, AdwSpinRow, AdwSwitchRow } from "@gtkx/jsx/adw";
import { GtkAdjustment } from "@gtkx/jsx/gtk";
import { createPortal, rootElement, useParentWindow, useSetting } from "@gtkx/react";
import schema from "#data/com.gtkx.tutorial.gschema.xml";

export const Preferences = ({ onClose }: { onClose: () => void }) => {
    const parentWindow = useParentWindow();

    const [compactMode, setCompactMode] = useSetting(schema, "compact-mode");
    const [spellCheck, setSpellCheck] = useSetting(schema, "spell-check");
    const [fontSize, setFontSize] = useSetting(schema, "font-size");

    if (!parentWindow) return null;

    return createPortal(
        <AdwPreferencesWindow
            title="Preferences"
            transientFor={parentWindow}
            modal
            defaultWidth={500}
            defaultHeight={400}
            onCloseRequest={() => {
                onClose();
                return true;
            }}
        >
            <AdwPreferencesPage title="General" iconName="preferences-system-symbolic">
                <AdwPreferencesGroup title="Appearance">
                    <AdwSwitchRow
                        title="Compact Mode"
                        subtitle="Use smaller spacing in the note list"
                        active={compactMode}
                        onNotifyActive={(active) => setCompactMode(active ?? false)}
                    />
                </AdwPreferencesGroup>
                <AdwPreferencesGroup title="Editor">
                    <AdwSwitchRow
                        title="Spell Check"
                        subtitle="Highlight spelling errors while typing"
                        active={spellCheck}
                        onNotifyActive={(active) => setSpellCheck(active ?? false)}
                    />
                    <AdwSpinRow
                        title="Font Size"
                        subtitle="Base font size for the editor"
                        adjustment={<GtkAdjustment value={fontSize} lower={8} upper={32} stepIncrement={1} />}
                        onNotifyValue={(value) => setFontSize(value ?? 8)}
                    />
                </AdwPreferencesGroup>
            </AdwPreferencesPage>
        </AdwPreferencesWindow>,
        rootElement,
    );
};
