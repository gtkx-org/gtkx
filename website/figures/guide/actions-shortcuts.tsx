import {
    AdwShortcutsDialog,
    AdwShortcutsItem,
    AdwShortcutsSection,
} from "@gtkx/jsx/adw";

export const Shortcuts = ({ onClose }: { onClose: () => void }) => (
    <AdwShortcutsDialog onClosed={onClose}>
        <AdwShortcutsSection title="General">
            <AdwShortcutsItem title="New note" actionName="win.new" />
            <AdwShortcutsItem title="Search notes" accelerator="<Control>f" />
            <AdwShortcutsItem
                title="Keyboard shortcuts"
                actionName="win.shortcuts"
            />
            <AdwShortcutsItem title="Quit" actionName="app.quit" />
        </AdwShortcutsSection>
    </AdwShortcutsDialog>
);
