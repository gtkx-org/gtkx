import {
    AdwPreferencesGroup,
    AdwPreferencesPage,
    AdwPreferencesWindow,
    AdwSpinRow,
    AdwSwitchRow,
    createPortal,
    useApplication,
    useProperty,
    useSetting,
} from "@gtkx/react";
import schemaId from "../../com.gtkx.tutorial.gschema.xml";

export const Preferences = ({ onClose }: { onClose: () => void }) => {
    const app = useApplication();
    const activeWindow = useProperty(app, "activeWindow");

    const [compactMode, setCompactMode] = useSetting(schemaId, "compact-mode", "boolean");
    const [spellCheck, setSpellCheck] = useSetting(schemaId, "spell-check", "boolean");
    const [fontSize, setFontSize] = useSetting(schemaId, "font-size", "int");

    if (!activeWindow) return null;

    return createPortal(
        <AdwPreferencesWindow title="Preferences" modal defaultWidth={500} defaultHeight={400} onClose={onClose}>
            <AdwPreferencesPage title="General" iconName="preferences-system-symbolic">
                <AdwPreferencesGroup title="Appearance">
                    <AdwSwitchRow
                        title="Compact Mode"
                        subtitle="Use smaller spacing in the note list"
                        active={compactMode}
                        onActiveChanged={setCompactMode}
                    />
                </AdwPreferencesGroup>
                <AdwPreferencesGroup title="Editor">
                    <AdwSwitchRow
                        title="Spell Check"
                        subtitle="Highlight spelling errors while typing"
                        active={spellCheck}
                        onActiveChanged={setSpellCheck}
                    />
                    <AdwSpinRow
                        title="Font Size"
                        subtitle="Base font size for the editor"
                        value={fontSize}
                        lower={8}
                        upper={32}
                        stepIncrement={1}
                        onValueChanged={setFontSize}
                    />
                </AdwPreferencesGroup>
            </AdwPreferencesPage>
        </AdwPreferencesWindow>,
        activeWindow,
    );
};
