import { t } from "@gtkx/i18n";
import { AdwShortcutsDialog, AdwShortcutsItem, AdwShortcutsSection } from "@gtkx/jsx/adw";

export const Shortcuts = ({ onClose }: { onClose: () => void }) => (
    <AdwShortcutsDialog onClosed={onClose}>
        <AdwShortcutsSection title={t("General")}>
            <AdwShortcutsItem title={t("New task")} accelerator="<Control>n" />
            <AdwShortcutsItem title={t("Search tasks")} accelerator="<Control>f" />
            <AdwShortcutsItem title={t("Preferences")} accelerator="<Control>comma" />
            <AdwShortcutsItem title={t("Keyboard shortcuts")} accelerator="<Control>question" />
        </AdwShortcutsSection>
        <AdwShortcutsSection title={t("Tasks")}>
            <AdwShortcutsItem title={t("Delete task")} accelerator="Delete" />
            <AdwShortcutsItem title={t("Go back")} accelerator="Escape" />
        </AdwShortcutsSection>
    </AdwShortcutsDialog>
);
