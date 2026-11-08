import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog } from "@gtkx/jsx/adw";

export function About({ onClose }: { onClose: () => void }) {
    return (
        <AdwAboutDialog
            onClosed={onClose}
            applicationName="Notes"
            links={[{ title: "User Guide", url: "https://example.org/guide" }]}
            creditSections={[{ name: "Design", people: ["Ada Lovelace"] }]}
            acknowledgementSections={[
                { name: "Thanks", people: ["Our translators"] },
            ]}
            legalSections={[
                {
                    title: "Sample data",
                    copyright: "© Example",
                    licenseType: Gtk.License.MIT_X11,
                },
            ]}
            otherApps={[
                {
                    appid: "org.example.Calendar",
                    name: "Calendar",
                    summary: "Plan your day",
                },
            ]}
        />
    );
}
