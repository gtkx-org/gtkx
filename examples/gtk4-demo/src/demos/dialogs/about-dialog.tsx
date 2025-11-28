import * as Gtk from "@gtkx/ffi/gtk";
import { AboutDialog, Box, Button, createPortal, Label } from "@gtkx/gtkx";
import { useState } from "react";
import type { Demo } from "../types.js";

export const AboutDialogDemo = () => {
    const [showDialog, setShowDialog] = useState(false);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="About Dialog" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root
                    label="AboutDialog displays information about your application including version, copyright, license, and credits."
                    wrap
                    cssClasses={["dim-label"]}
                />

                <Button
                    label="Show About Dialog"
                    cssClasses={["suggested-action"]}
                    onClicked={() => setShowDialog(true)}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="- Program name and version\n- Application description\n- Website link\n- Copyright notice\n- License type\n- Credits (authors, artists, documenters)"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            {showDialog &&
                createPortal(
                    <AboutDialog
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
                        modal
                        onCloseRequest={() => {
                            setShowDialog(false);
                            return false;
                        }}
                    />,
                )}
        </Box>
    );
};

export const aboutDialogDemo: Demo = {
    id: "about-dialog",
    title: "About Dialog",
    description: "Display application information, credits, and license.",
    keywords: ["about", "dialog", "credits", "license", "GtkAboutDialog"],
    component: AboutDialogDemo,
    source: `import * as Gtk from "@gtkx/ffi/gtk";
import { AboutDialog, Button, createPortal } from "@gtkx/gtkx";
import { useState } from "react";

const MyComponent = () => {
    const [showDialog, setShowDialog] = useState(false);

    return (
        <>
            <Button label="About" onClicked={() => setShowDialog(true)} />
            {showDialog &&
                createPortal(
                    <AboutDialog
                        programName="My App"
                        version="1.0.0"
                        comments="Application description"
                        website="https://example.com"
                        websiteLabel="Website"
                        copyright="Copyright 2024"
                        licenseType={Gtk.License.MIT_X11}
                        authors={["Author One", "Author Two"]}
                        modal
                        onCloseRequest={() => {
                            setShowDialog(false);
                            return false;
                        }}
                    />,
                )}
        </>
    );
};`,
};
