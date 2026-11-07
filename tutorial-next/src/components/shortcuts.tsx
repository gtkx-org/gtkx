import { t } from "@gtkx/i18n";
import { AdwShortcutsDialog, AdwShortcutsItem, AdwShortcutsSection } from "@gtkx/jsx/adw";

const Shortcuts = ({ onClose }: { onClose: () => void }) => (
    <AdwShortcutsDialog onClosed={onClose}>
        <AdwShortcutsSection title={t("General")}>
            <AdwShortcutsItem title={t("New note")} accelerator="<Control>n" />
            <AdwShortcutsItem title={t("Preferences")} accelerator="<Control>comma" />
            <AdwShortcutsItem title={t("Keyboard shortcuts")} accelerator="<Control>question" />
            <AdwShortcutsItem title={t("Quit")} accelerator="<Control>q" />
        </AdwShortcutsSection>
        <AdwShortcutsSection title={t("Notes")}>
            <AdwShortcutsItem title={t("Rename note")} accelerator="F2" />
            <AdwShortcutsItem title={t("Show preview")} accelerator="<Control><Shift>p" />
        </AdwShortcutsSection>
    </AdwShortcutsDialog>
);

export { Shortcuts };
