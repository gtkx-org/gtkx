import * as Gtk from "@gtkx/gi/gtk";
import { t } from "@gtkx/i18n";
import { AdwAboutDialog } from "@gtkx/jsx/adw";
import { applicationId } from "virtual:gtkx-config";
import packageManifest from "../../package.json" with { type: "json" };

const About = ({ onClose }: { onClose: () => void }) => (
    <AdwAboutDialog
        onClosed={onClose}
        applicationName={t("Notes")}
        applicationIcon={applicationId}
        version={packageManifest.version}
        developerName="GTKX"
        website="https://gtkx.dev"
        issueUrl="https://github.com/gtkx-org/gtkx/issues"
        copyright="© 2026 GTKX Contributors"
        licenseType={Gtk.License.MPL_2_0}
        developers={[t("GTKX Contributors")]}
        comments={t("Markdown notes kept as plain files, built with GTKX.")}
    />
);

export { About };
