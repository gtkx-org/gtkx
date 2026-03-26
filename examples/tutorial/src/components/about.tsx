import * as Gtk from "@gtkx/ffi/gtk";
import { AdwAboutDialog, createPortal, useApplication, useProperty } from "@gtkx/react";

export const About = ({ onClose }: { onClose: () => void }) => {
    const app = useApplication();
    const activeWindow = useProperty(app, "activeWindow");

    if (!activeWindow) return null;

    return createPortal(
        <AdwAboutDialog
            applicationName="Notes"
            applicationIcon="document-edit-symbolic"
            version="0.1.0"
            developerName="GTKX Tutorial"
            website="https://gtkx.dev"
            issueUrl="https://github.com/nicolo-ribaudo/gtkx/issues"
            copyright="\u00a9 2026 GTKX Contributors"
            licenseType={Gtk.License.MPL_2_0}
            developers={["GTKX Contributors"]}
            onClosed={onClose}
        />,
        activeWindow,
    );
};
