import { Dialog } from "@gtkx/components/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog } from "@gtkx/jsx/adw";
import { useApplication, useProperty } from "@gtkx/react";

export const About = ({ onClose }: { onClose: () => void }) => {
    const app = useApplication();
    const activeWindow = useProperty(app, "activeWindow");

    if (!activeWindow) return null;

    return (
        <Dialog parent={activeWindow}>
            <AdwAboutDialog
                applicationName="Notes"
                applicationIcon="document-edit-symbolic"
                version="0.1.0"
                developerName="GTKX Tutorial"
                website="https://gtkx.dev"
                issueUrl="https://github.com/gtkx-org/gtkx/issues"
                copyright="© 2026 GTKX Contributors"
                licenseType={Gtk.License.MPL_2_0}
                developers={["GTKX Contributors"]}
                onClosed={onClose}
            />
        </Dialog>
    );
};
