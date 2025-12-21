import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { createPortal, GtkAboutDialog, GtkBox, GtkButton, GtkLabel, useApplication } from "@gtkx/react";
import { useMemo, useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const LOGO_PATH = new URL("../../../../../logo.svg", import.meta.url).pathname;

const AboutDialogDemo = () => {
    const [showDialog, setShowDialog] = useState(false);
    const logo = useMemo(() => Gdk.Texture.newFromFilename(LOGO_PATH), []);
    const app = useApplication();
    const activeWindow = app.getActiveWindow();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="About Dialog" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel
                    label="GtkAboutDialog displays information about your application including version, copyright, license, and credits."
                    wrap
                    cssClasses={["dim-label"]}
                />

                <GtkButton
                    label="Show About Dialog"
                    cssClasses={["suggested-action"]}
                    onClicked={() => setShowDialog(true)}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`- Program name and version
- Application description
- Website link
- Copyright notice
- License type
- Credits (authors, artists, documenters)`}
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            {showDialog &&
                activeWindow &&
                createPortal(
                    <GtkAboutDialog
                        programName="GTKX Demo"
                        version="1.0.0"
                        comments="A demonstration of GTK4 widgets using React and TypeScript"
                        website="https://github.com/eugeniodepalo/gtkx"
                        websiteLabel="GitHub Repository"
                        copyright="Copyright 2024 GTKX Contributors"
                        licenseType={Gtk.License.MIT_X11}
                        authors={["Developer One", "Developer Two"]}
                        artists={["Artist One"]}
                        documenters={["Documenter One"]}
                        logo={logo}
                        onCloseRequest={() => {
                            setShowDialog(false);
                            return false;
                        }}
                    />,
                    activeWindow,
                )}
        </GtkBox>
    );
};

export const aboutDialogDemo: Demo = {
    id: "about-dialog",
    title: "About Dialog",
    description: "Display application information, credits, and license.",
    keywords: ["about", "dialog", "credits", "license", "GtkAboutDialog"],
    component: AboutDialogDemo,
    sourcePath: getSourcePath(import.meta.url, "about-dialog.tsx"),
};
