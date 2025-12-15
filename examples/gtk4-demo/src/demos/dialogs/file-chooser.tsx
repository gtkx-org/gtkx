import { getCurrentApp } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const FileChooserDemo = () => {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [saveLocation, setSaveLocation] = useState<string | null>(null);

    const openSingleFile = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Open File");

        try {
            const file = await dialog.open(getCurrentApp().getActiveWindow() ?? undefined);
            setSelectedFile(file.getPath() ?? null);
        } catch {
            setSelectedFile(null);
        }
    };

    const selectFolder = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Select Folder");

        try {
            const folder = await dialog.selectFolder(getCurrentApp().getActiveWindow() ?? undefined);
            setSelectedFolder(folder.getPath() ?? null);
        } catch {
            setSelectedFolder(null);
        }
    };

    const saveFile = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Save File");
        dialog.setInitialName("untitled.txt");

        try {
            const file = await dialog.save(getCurrentApp().getActiveWindow() ?? undefined);
            setSaveLocation(file.getPath() ?? null);
        } catch {
            setSaveLocation(null);
        }
    };

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="File Chooser" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Open File" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Button label="Open File..." onClicked={openSingleFile} />
                {selectedFile && <Label label={`Selected: ${selectedFile}`} cssClasses={["dim-label"]} wrap />}
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Select Folder" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Button label="Select Folder..." onClicked={selectFolder} />
                {selectedFolder && <Label label={`Selected: ${selectedFolder}`} cssClasses={["dim-label"]} wrap />}
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Save File" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Button label="Save As..." onClicked={saveFile} />
                {saveLocation && <Label label={`Would save to: ${saveLocation}`} cssClasses={["dim-label"]} wrap />}
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="About FileDialog" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="FileDialog is the modern GTK4 file chooser. It uses async/await and returns Gio.File objects that can be used to read or write file contents."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};

export const fileChooserDemo: Demo = {
    id: "file-chooser",
    title: "File Chooser",
    description: "Native file and folder selection dialogs.",
    keywords: ["file", "folder", "open", "save", "dialog", "GtkFileDialog"],
    component: FileChooserDemo,
    sourcePath: getSourcePath(import.meta.url, "file-chooser.tsx"),
};
