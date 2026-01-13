import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkColorDialogButton,
    GtkFontDialogButton,
    GtkFrame,
    GtkLabel,
    useApplication,
} from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./pickers.tsx?raw";

const PickersDemo = () => {
    const app = useApplication();
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [selectedFont, setSelectedFont] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [saveLocation, setSaveLocation] = useState<string | null>(null);

    const formatRgba = (rgba: { red: number; green: number; blue: number; alpha: number }) => {
        return `rgba(${Math.round(rgba.red * 255)}, ${Math.round(rgba.green * 255)}, ${Math.round(rgba.blue * 255)}, ${rgba.alpha.toFixed(2)})`;
    };

    const handleColorButtonNotify = (button: Gtk.ColorDialogButton, propName: string) => {
        if (propName === "rgba") {
            const rgba = button.getRgba();
            setSelectedColor(formatRgba(rgba));
        }
    };

    const handleFontButtonNotify = (button: Gtk.FontDialogButton, propName: string) => {
        if (propName === "font-desc") {
            const fontDesc = button.getFontDesc();
            if (fontDesc) {
                setSelectedFont(fontDesc.toString());
            }
        }
    };

    const handleColorPick = async () => {
        try {
            const colorDialog = new Gtk.ColorDialog();
            colorDialog.setTitle("Choose a Color");
            colorDialog.setModal(true);

            const rgba = await colorDialog.chooseRgbaAsync(app.getActiveWindow() ?? undefined);
            setSelectedColor(formatRgba(rgba));
        } catch {}
    };

    const handleFontPick = async () => {
        try {
            const fontDialog = new Gtk.FontDialog();
            fontDialog.setTitle("Choose a Font");
            fontDialog.setModal(true);

            const fontDesc = await fontDialog.chooseFontAsync(app.getActiveWindow() ?? undefined);
            setSelectedFont(fontDesc.toString());
        } catch {}
    };

    const handleFileOpen = async () => {
        try {
            const fileDialog = new Gtk.FileDialog();
            fileDialog.setTitle("Open File");
            fileDialog.setModal(true);

            const file = await fileDialog.openAsync(app.getActiveWindow() ?? undefined);
            setSelectedFile(file.getPath() ?? file.getUri());
        } catch {}
    };

    const handleFolderSelect = async () => {
        try {
            const fileDialog = new Gtk.FileDialog();
            fileDialog.setTitle("Select Folder");
            fileDialog.setModal(true);

            const folder = await fileDialog.selectFolderAsync(app.getActiveWindow() ?? undefined);
            setSelectedFolder(folder.getPath() ?? folder.getUri());
        } catch {}
    };

    const handleFileSave = async () => {
        try {
            const fileDialog = new Gtk.FileDialog();
            fileDialog.setTitle("Save File");
            fileDialog.setModal(true);
            fileDialog.setInitialName("untitled.txt");

            const file = await fileDialog.saveAsync(app.getActiveWindow() ?? undefined);
            setSaveLocation(file.getPath() ?? file.getUri());
        } catch {}
    };

    const handleMultipleFiles = async () => {
        try {
            const fileDialog = new Gtk.FileDialog();
            fileDialog.setTitle("Select Multiple Files");
            fileDialog.setModal(true);

            const files = await fileDialog.openMultipleAsync(app.getActiveWindow() ?? undefined);
            const count = files.getNItems();
            setSelectedFile(`${count} file(s) selected`);
        } catch {}
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Picker Dialogs" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GTK4 provides specialized dialogs for picking colors, fonts, and files. These dialogs use async/await patterns and integrate with the native file system."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Color Picker">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GtkColorDialog opens a color chooser. GtkColorDialogButton provides a convenient button that shows the selected color."
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                        wrap
                    />
                    <GtkBox spacing={12}>
                        <GtkButton label="Choose Color..." onClicked={() => void handleColorPick()} />
                        <GtkColorDialogButton dialog={new Gtk.ColorDialog()} onNotify={handleColorButtonNotify} />
                    </GtkBox>
                    {selectedColor && (
                        <GtkLabel
                            label={`Selected: ${selectedColor}`}
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Font Picker">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GtkFontDialog opens a font chooser. GtkFontDialogButton provides a button that displays the selected font name."
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                        wrap
                    />
                    <GtkBox spacing={12}>
                        <GtkButton label="Choose Font..." onClicked={() => void handleFontPick()} />
                        <GtkFontDialogButton dialog={new Gtk.FontDialog()} onNotify={handleFontButtonNotify} />
                    </GtkBox>
                    {selectedFont && (
                        <GtkLabel
                            label={`Selected: ${selectedFont}`}
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="File Picker">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GtkFileDialog provides methods for opening files, selecting folders, saving files, and selecting multiple files."
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                        wrap
                    />
                    <GtkBox spacing={8}>
                        <GtkButton label="Open File" onClicked={() => void handleFileOpen()} />
                        <GtkButton label="Select Multiple" onClicked={() => void handleMultipleFiles()} />
                        <GtkButton label="Select Folder" onClicked={() => void handleFolderSelect()} />
                        <GtkButton label="Save As..." onClicked={() => void handleFileSave()} />
                    </GtkBox>
                    {selectedFile && (
                        <GtkLabel
                            label={`File: ${selectedFile}`}
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                            ellipsize={3}
                        />
                    )}
                    {selectedFolder && (
                        <GtkLabel
                            label={`Folder: ${selectedFolder}`}
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                            ellipsize={3}
                        />
                    )}
                    {saveLocation && (
                        <GtkLabel
                            label={`Save to: ${saveLocation}`}
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                            ellipsize={3}
                        />
                    )}
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const pickersDemo: Demo = {
    id: "pickers",
    title: "Pickers and Launchers",
    description: "Color, font, and file picker dialogs",
    keywords: [
        "color",
        "font",
        "file",
        "picker",
        "chooser",
        "dialog",
        "GtkColorDialog",
        "GtkFontDialog",
        "GtkFileDialog",
        "open",
        "save",
    ],
    component: PickersDemo,
    sourceCode,
};
