import { Dialog } from "@gtkx/components/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog } from "@gtkx/jsx/adw";

export const About = ({ onClose }: { onClose: () => void }) => {
    return (
        <Dialog>
            <AdwAboutDialog
                applicationName="Tasks"
                applicationIcon="com.gtkx.tutorial"
                version="1.0.0"
                developerName="GTKX"
                website="https://gtkx.dev"
                issueUrl="https://github.com/gtkx-org/gtkx/issues"
                copyright="© 2026 GTKX Contributors"
                licenseType={Gtk.License.MPL_2_0}
                developers={["GTKX Contributors"]}
                comments="A task manager built with GTKX to showcase React, GTK4, and libadwaita."
                onClosed={onClose}
            />
        </Dialog>
    );
};
