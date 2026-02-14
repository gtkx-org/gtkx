import * as Gdk from "@gtkx/ffi/gdk";
import * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkColorDialogButton,
    GtkDropTarget,
    GtkFontDialogButton,
    GtkGrid,
    GtkLabel,
    x,
} from "@gtkx/react";
import { useCallback, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./pickers.tsx?raw";

let gFileTypeCache: number | null = null;
const getGFileType = () => {
    if (gFileTypeCache === null) {
        gFileTypeCache = GObject.typeFromName("GFile");
    }
    return gFileTypeCache;
};

const DIALOG_TIMEOUT_SECONDS = 20;

const PickersDemo = ({ window }: DemoProps) => {
    const [selectedFile, setSelectedFile] = useState<Gio.File | null>(null);
    const [fileName, setFileName] = useState("None");
    const [isPdf, setIsPdf] = useState(false);

    const [colorWidget, setColorWidget] = useState<Gtk.ColorDialogButton | null>(null);
    const [fontWidget, setFontWidget] = useState<Gtk.FontDialogButton | null>(null);
    const [fileButtonWidget, setFileButtonWidget] = useState<Gtk.Button | null>(null);
    const [uriButtonWidget, setUriButtonWidget] = useState<Gtk.Button | null>(null);

    const setFile = useCallback((file: Gio.File) => {
        setSelectedFile(file);
        setFileName(file.getBasename() ?? file.getUri());
        const info = file.queryInfo("standard::content-type", 0, null);
        setIsPdf(info.getContentType() === "application/pdf");
    }, []);

    const handleFileDrop = useCallback(
        (value: GObject.Value) => {
            const file = value.getObject();
            if (file && file instanceof Gio.File) {
                setFile(file);
                return true;
            }
            return false;
        },
        [setFile],
    );

    const handleOpenFile = async () => {
        const cancellable = new Gio.Cancellable();
        const timeoutId = setTimeout(() => cancellable.cancel(), DIALOG_TIMEOUT_SECONDS * 1000);
        try {
            const fileDialog = new Gtk.FileDialog();
            const file = await fileDialog.openAsync(window.current, cancellable);
            clearTimeout(timeoutId);
            setFile(file);
        } catch (e) {
            clearTimeout(timeoutId);
            if (e instanceof Error) console.error(e.message);
            setSelectedFile(null);
            setFileName("None");
            setIsPdf(false);
        }
    };

    const handleLaunchApp = useCallback(async () => {
        if (!selectedFile) return;
        try {
            const launcher = new Gtk.FileLauncher(selectedFile);
            await launcher.launchAsync(window.current);
        } catch (e) {
            if (e instanceof Error) console.error(e.message);
        }
    }, [window, selectedFile]);

    const handleOpenFolder = useCallback(async () => {
        if (!selectedFile) return;
        try {
            const launcher = new Gtk.FileLauncher(selectedFile);
            await launcher.openContainingFolderAsync(window.current);
        } catch (e) {
            if (e instanceof Error) console.error(e.message);
        }
    }, [window, selectedFile]);

    const handlePrintFile = useCallback(async () => {
        if (!selectedFile || !isPdf) return;
        const cancellable = new Gio.Cancellable();
        const timeoutId = setTimeout(() => cancellable.cancel(), DIALOG_TIMEOUT_SECONDS * 1000);
        try {
            const printDialog = new Gtk.PrintDialog();
            await printDialog.printFileAsync(selectedFile, window.current, null, cancellable);
            clearTimeout(timeoutId);
        } catch (e) {
            clearTimeout(timeoutId);
            if (e instanceof Error) console.error(e.message);
        }
    }, [window, selectedFile, isPdf]);

    const handleLaunchUri = useCallback(async () => {
        try {
            const launcher = new Gtk.UriLauncher("http://www.gtk.org");
            await launcher.launchAsync(window.current);
        } catch (e) {
            if (e instanceof Error) console.error(e.message);
        }
    }, [window]);

    return (
        <GtkGrid rowSpacing={6} columnSpacing={6} marginStart={20} marginEnd={20} marginTop={20} marginBottom={20}>
            <x.GridChild column={0} row={0}>
                <GtkLabel
                    label="_Color:"
                    useUnderline
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.CENTER}
                    hexpand
                    mnemonicWidget={colorWidget}
                />
            </x.GridChild>
            <x.GridChild column={1} row={0}>
                <GtkColorDialogButton ref={setColorWidget} />
            </x.GridChild>

            <x.GridChild column={0} row={1}>
                <GtkLabel
                    label="_Font:"
                    useUnderline
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.CENTER}
                    hexpand
                    mnemonicWidget={fontWidget}
                />
            </x.GridChild>
            <x.GridChild column={1} row={1}>
                <GtkFontDialogButton ref={setFontWidget} />
            </x.GridChild>

            <x.GridChild column={0} row={2}>
                <GtkLabel
                    label="_File:"
                    useUnderline
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.CENTER}
                    hexpand
                    mnemonicWidget={fileButtonWidget}
                />
            </x.GridChild>
            <x.GridChild column={1} row={2}>
                <GtkBox spacing={6}>
                    <GtkLabel label={fileName} xalign={0} ellipsize={2} hexpand />
                    <GtkButton
                        ref={setFileButtonWidget}
                        iconName="document-open-symbolic"
                        accessibleLabel="Select File"
                        accessibleHasPopup
                        onClicked={() => void handleOpenFile()}
                    >
                        <GtkDropTarget types={[getGFileType()]} actions={Gdk.DragAction.COPY} onDrop={handleFileDrop} />
                    </GtkButton>
                    <GtkButton
                        iconName="emblem-system-symbolic"
                        accessibleLabel="Open File"
                        accessibleHasPopup
                        sensitive={selectedFile !== null}
                        onClicked={() => void handleLaunchApp()}
                    />
                    <GtkButton
                        iconName="folder-symbolic"
                        accessibleLabel="Open in Folder"
                        accessibleHasPopup
                        sensitive={selectedFile !== null}
                        onClicked={() => void handleOpenFolder()}
                    />
                    <GtkButton
                        iconName="printer-symbolic"
                        accessibleLabel="Print file"
                        tooltipText="Print file"
                        sensitive={isPdf}
                        onClicked={() => void handlePrintFile()}
                    />
                </GtkBox>
            </x.GridChild>

            <x.GridChild column={0} row={3}>
                <GtkLabel
                    label="_URI:"
                    useUnderline
                    halign={Gtk.Align.START}
                    valign={Gtk.Align.CENTER}
                    hexpand
                    mnemonicWidget={uriButtonWidget}
                />
            </x.GridChild>
            <x.GridChild column={1} row={3}>
                <GtkButton
                    ref={setUriButtonWidget}
                    label="www.gtk.org"
                    accessibleLabel="Open www.gtk.org"
                    accessibleHasPopup
                    onClicked={() => void handleLaunchUri()}
                />
            </x.GridChild>
        </GtkGrid>
    );
};

export const pickersDemo: Demo = {
    id: "pickers",
    title: "Pickers and Launchers",
    description:
        "The dialogs are mainly intended for use in preference dialogs. They allow to select colors, fonts and files. Additionally, GtkPrintDialog provides a way to print files and GtkUriLauncher and GtkFileLauncher allow launching URIs and files.",
    keywords: [
        "color",
        "font",
        "file",
        "picker",
        "GtkColorDialog",
        "GtkFontDialog",
        "GtkFileDialog",
        "GtkPrintDialog",
        "GtkFileLauncher",
        "GtkUriLauncher",
    ],
    component: PickersDemo,
    sourceCode,
};
