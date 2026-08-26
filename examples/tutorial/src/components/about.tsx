import * as Gtk from "@gtkx/gi/gtk";
import { t } from "@gtkx/i18n";
import { AdwAboutDialog } from "@gtkx/jsx/adw";

export const About = ({ onClose }: { onClose: () => void }) => {
    return (
        <AdwAboutDialog
            onClosed={onClose}
            applicationName={t("Tasks")}
            applicationIcon="com.gtkx.tutorial"
            version="1.0.0"
            developerName="GTKX"
            website="https://gtkx.dev"
            issueUrl="https://github.com/gtkx-org/gtkx/issues"
            copyright="© 2026 GTKX Contributors"
            licenseType={Gtk.License.MPL_2_0}
            developers={[t("GTKX Contributors")]}
            comments={t("A task manager built with GTKX to showcase React, GTK4, and Adwaita.")}
        />
    );
};
