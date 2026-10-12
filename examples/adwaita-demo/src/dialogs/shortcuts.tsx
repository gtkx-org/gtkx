import * as Gtk from "@gtkx/gi/gtk";
import { AdwShortcutsDialog, AdwShortcutsItem, AdwShortcutsSection } from "@gtkx/jsx/adw";

const ShortcutsDialog = ({ onClose }: { onClose: () => void }) => (
    <AdwShortcutsDialog onClosed={onClose}>
        <AdwShortcutsSection title="General">
            <AdwShortcutsItem title="Open Menu" accelerator="F10" />
            <AdwShortcutsItem title="Preferences" accelerator="<Control>comma" />
            <AdwShortcutsItem title="Keyboard Shortcuts" accelerator="<Control>question" />
            <AdwShortcutsItem title="Close Current Window" accelerator="<Control>w" />
            <AdwShortcutsItem title="Quit" accelerator="<Control>q" />
        </AdwShortcutsSection>
        <AdwShortcutsSection title="Tab View">
            <AdwShortcutsItem title="New Tab" accelerator="<Control>t" />
            <AdwShortcutsItem title="New Window" accelerator="<Control>n" />
            <AdwShortcutsItem title="Close Tab" accelerator="<Control>w" />
        </AdwShortcutsSection>
        <AdwShortcutsSection>
            <AdwShortcutsItem title="Previous Tab" accelerator="<Shift><Control>Tab <Control>Page_Up" />
            <AdwShortcutsItem title="Next Tab" accelerator="<Control>Tab <Control>Page_Down" />
            <AdwShortcutsItem title="First Tab" accelerator="<Control>Home" />
            <AdwShortcutsItem title="Last Tab" accelerator="<Control>End" />
        </AdwShortcutsSection>
        <AdwShortcutsSection>
            <AdwShortcutsItem
                title="Move Tab Left"
                accelerator="<Shift><Control>Page_Up"
                direction={Gtk.TextDirection.LTR}
            />
            <AdwShortcutsItem
                title="Move Tab Right"
                accelerator="<Shift><Control>Page_Down"
                direction={Gtk.TextDirection.LTR}
            />
            <AdwShortcutsItem
                title="Move Tab Right"
                accelerator="<Shift><Control>Page_Up"
                direction={Gtk.TextDirection.RTL}
            />
            <AdwShortcutsItem
                title="Move Tab Left"
                accelerator="<Shift><Control>Page_Down"
                direction={Gtk.TextDirection.RTL}
            />
        </AdwShortcutsSection>
        <AdwShortcutsSection>
            <AdwShortcutsItem title="Switch to Tab 1–9" accelerator="<Alt>1...9" />
            <AdwShortcutsItem title="Switch to Tab 10" accelerator="<Alt>0" />
        </AdwShortcutsSection>
    </AdwShortcutsDialog>
);

export { ShortcutsDialog };
