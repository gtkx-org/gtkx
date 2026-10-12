import * as Adw from "@gtkx/gi/adw";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog } from "@gtkx/jsx/adw";
import * as os from "node:os";
import { useEffect, useState } from "react";
import notice from "../../NOTICE.txt?raw";
import lgpl from "../../data/licenses/LGPL-2.1.txt?raw";
import cc0 from "../../data/licenses/CC0-1.0.txt?raw";
import ccBySa from "../../data/licenses/CC-BY-SA-4.0.txt?raw";

const AppAboutDialog = ({ onClose }: { onClose: () => void }) => {
    const [dialog, setDialog] = useState<Adw.AboutDialog | null>(null);
    useEffect(() => {
        if (!dialog) {
            return;
        }
        dialog.addLegalSection(
            "Original libadwaita demo",
            GLib.markupEscapeText(notice, -1),
            Gtk.License.CUSTOM,
            GLib.markupEscapeText(lgpl, -1),
        );
        dialog.addLegalSection(
            "Symbolic icons",
            "Authors credited in the original SVG metadata",
            Gtk.License.CUSTOM,
            GLib.markupEscapeText(cc0, -1),
        );
        dialog.addLegalSection(
            "Application artwork",
            "GNOME Design Team",
            Gtk.License.CUSTOM,
            GLib.markupEscapeText(ccBySa, -1),
        );
        dialog.addLink(
            "Original Demo",
            "https://github.com/GNOME/libadwaita/tree/5789add99c79cee0fae624b56706c7c0bea7fb2b/demo",
        );
    }, [dialog]);
    return (
        <AdwAboutDialog
            ref={setDialog}
            applicationName="Adwaita Demo (GTKX)"
            applicationIcon="org.gnome.Adwaita1.Demo"
            developerName="GTKX"
            version="1.9.3"
            website="https://gtkx.dev"
            issueUrl="https://github.com/gtkx-org/gtkx/issues"
            comments="The official libadwaita 1.9.3 demo reimplemented with GTKX."
            licenseType={Gtk.License.MPL_2_0}
            copyright="Original demo © 2017–2022 Purism SPC, © 2023–2024 GNOME Foundation Inc."
            debugInfo={[
                "GTKX Adwaita Demo",
                "Reference: libadwaita 1.9.3 (5789add99c79cee0fae624b56706c7c0bea7fb2b)",
                `Node.js: ${process.version}`,
                `GTK: ${Gtk.getMajorVersion()}.${Gtk.getMinorVersion()}.${Gtk.getMicroVersion()}`,
                `Adwaita: ${Adw.getMajorVersion()}.${Adw.getMinorVersion()}.${Adw.getMicroVersion()}`,
                `System: ${GLib.getOsInfo("NAME") ?? os.type()} ${GLib.getOsInfo("VERSION") ?? os.release()}`,
                `Architecture: ${os.arch()}`,
                `Desktop: ${process.env.XDG_CURRENT_DESKTOP ?? "unknown"}`,
                `Session: ${process.env.XDG_SESSION_TYPE ?? "unknown"}`,
            ].join("\n")}
            debugInfoFilename="gtkx-adwaita-demo-debug-info.txt"
            onClosed={onClose}
        />
    );
};

export { AppAboutDialog };
