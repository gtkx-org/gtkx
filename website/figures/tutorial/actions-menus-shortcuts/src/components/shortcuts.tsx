import { t } from "@gtkx/i18n";
import {
    AdwShortcutsDialog,
    AdwShortcutsItem,
    AdwShortcutsSection,
} from "@gtkx/jsx/adw";

const Shortcuts = ({ onClose }: { onClose: () => void }) => (
    <AdwShortcutsDialog onClosed={onClose}>
        <AdwShortcutsSection title={t("General")}>
            <AdwShortcutsItem title={t("New note")} actionName="win.new-note" />
            <AdwShortcutsItem
                title={t("Keyboard shortcuts")}
                actionName="win.shortcuts"
            />
            <AdwShortcutsItem title={t("Quit")} actionName="app.quit" />
        </AdwShortcutsSection>
        <AdwShortcutsSection title={t("Notes")}>
            <AdwShortcutsItem
                title={t("Search notes")}
                accelerator="<Control>f"
            />
            <AdwShortcutsItem
                title={t("Show preview")}
                actionName="win.preview"
            />
        </AdwShortcutsSection>
    </AdwShortcutsDialog>
);

export { Shortcuts };
