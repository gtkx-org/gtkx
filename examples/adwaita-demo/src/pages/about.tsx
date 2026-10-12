import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAboutDialog, AdwHeaderBar, AdwStatusPage, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useState } from "react";

const configuredDialogs = new WeakSet<Adw.AboutDialog>();

const configureDialog = (dialog: Adw.AboutDialog | null) => {
    if (dialog === null || configuredDialogs.has(dialog)) return;
    configuredDialogs.add(dialog);
    dialog.addLink("_Documentation", "https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/class.AboutDialog.html");
    dialog.addLegalSection(
        "Fonts",
        null,
        Gtk.License.CUSTOM,
        "This application uses font data from <a href='https://example.org'>somewhere</a>.",
    );
    dialog.addAcknowledgementSection("Special thanks to", ["My cat"]);
    dialog.addOtherApp("org.gnome.Adwaita1.Demo", "Adwaita Demo", "Tour of the features in Libadwaita");
};

const releaseNotes =
    "<p>This release adds the following features:</p><ul>" +
    "<li>Added a way to export fonts.</li>" +
    "<li>Better support for <code>monospace</code> fonts.</li>" +
    "<li>Added a way to preview <em>italic</em> text.</li>" +
    "<li>Bug fixes and performance improvements.</li>" +
    "<li>Translation updates.</li></ul>";

export const AboutPage = () => {
    const [open, setOpen] = useState(false);

    return (
        <AdwToolbarView topBar={<AdwHeaderBar showTitle={false} />}>
            <AdwStatusPage iconName="widget-about-symbolic" title="About Dialog" description="An about dialog">
                <GtkButton
                    label="Run Demo"
                    halign={Gtk.Align.CENTER}
                    cssClasses={["pill"]}
                    onClicked={() => setOpen(true)}
                />
            </AdwStatusPage>
            {open && (
                <AdwAboutDialog
                    ref={configureDialog}
                    applicationIcon="org.example.Typeset"
                    applicationName="Typeset"
                    developerName="Angela Avery"
                    version="1.2.3"
                    releaseNotesVersion="1.2.0"
                    releaseNotes={releaseNotes}
                    comments="Typeset is an app that doesn’t exist and is used as an example content for this about dialog."
                    website="https://example.org"
                    issueUrl="https://example.org"
                    supportUrl="https://example.org"
                    copyright="© 2022 Angela Avery"
                    licenseType={Gtk.License.LGPL_2_1}
                    developers={["Angela Avery <angela@example.org>"]}
                    artists={["GNOME Design Team"]}
                    translatorCredits="translator-credits"
                    onClosed={() => setOpen(false)}
                />
            )}
        </AdwToolbarView>
    );
};
