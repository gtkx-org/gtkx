import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkColorDialog,
    GtkColorDialogButton,
    GtkDropTarget,
    GtkFontDialog,
    GtkFontDialogButton,
    GtkGrid,
    GtkGridLayoutChild,
    GtkLabel,
} from "@gtkx/jsx/gtk";
import { useParentWindow } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./pickers.tsx?raw";

const gfileType = Gio.File.prototype.__type__;

const DIALOG_TIMEOUT_SECONDS = 20;

const isCancellation = (error: unknown): boolean =>
    (error instanceof Gtk.DialogError &&
        (error.code === Gtk.DialogError.DISMISSED || error.code === Gtk.DialogError.CANCELLED)) ||
    (error instanceof Gio.IOErrorEnum && error.code === Gio.IOErrorEnum.CANCELLED);

const reportPickerError = (error: unknown): void => {
    if (isCancellation(error)) return;
    if (error instanceof Error) console.error(error.message);
};

function useFilePickerState() {
    const [selectedFile, setSelectedFile] = useState<Gio.File | null>(null);
    const [fileName, setFileName] = useState("None");
    const [isPdf, setIsPdf] = useState(false);

    const setFile = (file: Gio.File) => {
        setSelectedFile(file);
        setFileName(file.getBasename() ?? file.getUri() ?? "");
        const info = file.queryInfo("standard::content-type", 0, null);
        setIsPdf(info.getContentType() === "application/pdf");
    };

    return { selectedFile, setSelectedFile, fileName, setFileName, isPdf, setIsPdf, setFile };
}

type FilePickerState = ReturnType<typeof useFilePickerState>;

const runWithTimeout = async (action: (cancellable: Gio.Cancellable) => Promise<void>) => {
    const cancellable = new Gio.Cancellable();
    const timeoutId = setTimeout(() => cancellable.cancel(), DIALOG_TIMEOUT_SECONDS * 1000);
    try {
        await action(cancellable);
    } finally {
        clearTimeout(timeoutId);
    }
};

const launchFile = async (selectedFile: Gio.File | null, action: (launcher: Gtk.FileLauncher) => Promise<void>) => {
    if (!selectedFile) return;
    try {
        const launcher = Gtk.FileLauncher.new(selectedFile);
        await action(launcher);
    } catch (e) {
        reportPickerError(e);
    }
};

function useDropAndOpenHandlers(parentWindow: Gtk.Window | null, state: FilePickerState) {
    const { setFile, setSelectedFile, setFileName, setIsPdf } = state;

    const handleFileDrop = (value: GObject.Value) => {
        if (!GObject.typeCheckValueHolds(value, gfileType)) return false;
        const file = value.getObject();
        if (file && file instanceof Gio.File) {
            setFile(file);
            return true;
        }
        return false;
    };

    const handleOpenFile = async () => {
        await runWithTimeout(async (cancellable) => {
            const fileDialog = new Gtk.FileDialog();
            try {
                const file = await fileDialog.open(parentWindow, cancellable);
                setFile(file);
            } catch (e) {
                if (isCancellation(e)) return;
                reportPickerError(e);
                setSelectedFile(null);
                setFileName("None");
                setIsPdf(false);
            }
        });
    };

    return { handleFileDrop, handleOpenFile };
}

function useFileLaunchHandlers(parentWindow: Gtk.Window | null, state: FilePickerState) {
    const { selectedFile, isPdf } = state;

    const handleLaunchApp = () =>
        launchFile(selectedFile, async (l) => {
            await l.launch(parentWindow, null);
        });

    const handleOpenFolder = () =>
        launchFile(selectedFile, async (l) => {
            await l.openContainingFolder(parentWindow, null);
        });

    const handlePrintFile = async () => {
        if (!selectedFile || !isPdf) return;
        await runWithTimeout(async (cancellable) => {
            try {
                const printDialog = new Gtk.PrintDialog();
                await printDialog.printFile(parentWindow, null, selectedFile, cancellable);
            } catch (e) {
                reportPickerError(e);
            }
        });
    };

    const handleLaunchUri = async () => {
        try {
            const launcher = Gtk.UriLauncher.new("http://www.gtk.org");
            await launcher.launch(parentWindow, null);
        } catch (e) {
            reportPickerError(e);
        }
    };

    return { handleLaunchApp, handleOpenFolder, handlePrintFile, handleLaunchUri };
}

function useFilePickerHandlers(parentWindow: Gtk.Window | null, state: FilePickerState) {
    const dropAndOpen = useDropAndOpenHandlers(parentWindow, state);
    const launch = useFileLaunchHandlers(parentWindow, state);
    return { ...dropAndOpen, ...launch };
}

interface ColorRowProps {
    colorWidget: Gtk.ColorDialogButton | null;
    setColorWidget: (w: Gtk.ColorDialogButton | null) => void;
}

const ColorPickerRow = ({ colorWidget, setColorWidget }: ColorRowProps) => (
    <>
        <GtkGridLayoutChild column={0} row={0}>
            <GtkLabel
                useUnderline
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
                mnemonicWidget={colorWidget}
            >
                _Color:
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={0}>
            <GtkColorDialogButton
                name="color-button"
                ref={(node) => {
                    setColorWidget(node);
                }}
                dialog={<GtkColorDialog />}
            />
        </GtkGridLayoutChild>
    </>
);

interface FontRowProps {
    fontWidget: Gtk.FontDialogButton | null;
    setFontWidget: (w: Gtk.FontDialogButton | null) => void;
}

const FontPickerRow = ({ fontWidget, setFontWidget }: FontRowProps) => (
    <>
        <GtkGridLayoutChild column={0} row={1}>
            <GtkLabel
                useUnderline
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
                mnemonicWidget={fontWidget}
            >
                _Font:
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={1}>
            <GtkFontDialogButton
                name="font-button"
                ref={(node) => {
                    setFontWidget(node);
                }}
                dialog={<GtkFontDialog />}
            />
        </GtkGridLayoutChild>
    </>
);

interface FilePickerRowProps {
    fileState: FilePickerState;
    handlers: ReturnType<typeof useFilePickerHandlers>;
    fileButtonWidget: Gtk.Button | null;
    setFileButtonWidget: (w: Gtk.Button | null) => void;
}

const FilePickerRow = ({ fileState, handlers, fileButtonWidget, setFileButtonWidget }: FilePickerRowProps) => (
    <>
        <GtkGridLayoutChild column={0} row={2}>
            <GtkLabel
                useUnderline
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
                mnemonicWidget={fileButtonWidget}
            >
                _File:
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={2}>
            <GtkBox spacing={6}>
                <GtkLabel xalign={0} ellipsize={2} hexpand>
                    {fileState.fileName}
                </GtkLabel>
                <GtkButton
                    name="select-file-button"
                    ref={setFileButtonWidget}
                    iconName="document-open-symbolic"
                    accessibleLabel="Select File"
                    accessibleHasPopup
                    onClicked={() => void handlers.handleOpenFile()}
                    controllers={
                        <GtkDropTarget
                            types={[gfileType]}
                            actions={Gdk.DragAction.COPY}
                            onDrop={handlers.handleFileDrop}
                        />
                    }
                />
                <GtkButton
                    name="open-file-button"
                    iconName="system-run-symbolic"
                    accessibleLabel="Open File"
                    accessibleHasPopup
                    halign={Gtk.Align.END}
                    sensitive={fileState.selectedFile !== null}
                    onClicked={() => void handlers.handleLaunchApp()}
                />
                <GtkButton
                    name="open-folder-button"
                    iconName="folder-symbolic"
                    accessibleLabel="Open in Folder"
                    accessibleHasPopup
                    halign={Gtk.Align.END}
                    sensitive={fileState.selectedFile !== null}
                    onClicked={() => void handlers.handleOpenFolder()}
                />
                <GtkButton
                    name="print-button"
                    iconName="printer-symbolic"
                    accessibleLabel="Print File"
                    tooltipText="Print File"
                    sensitive={fileState.isPdf}
                    onClicked={() => void handlers.handlePrintFile()}
                />
            </GtkBox>
        </GtkGridLayoutChild>
    </>
);

interface UriRowProps {
    uriButtonWidget: Gtk.Button | null;
    setUriButtonWidget: (w: Gtk.Button | null) => void;
    onLaunchUri: () => Promise<void>;
}

const UriPickerRow = ({ uriButtonWidget, setUriButtonWidget, onLaunchUri }: UriRowProps) => (
    <>
        <GtkGridLayoutChild column={0} row={3}>
            <GtkLabel
                useUnderline
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
                mnemonicWidget={uriButtonWidget}
            >
                _URI:
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={3}>
            <GtkButton
                ref={(node) => {
                    setUriButtonWidget(node);
                }}
                label="www.gtk.org"
                accessibleLabel="Open www.gtk.org"
                accessibleHasPopup
                onClicked={() => void onLaunchUri()}
            />
        </GtkGridLayoutChild>
    </>
);

const PickersDemo = () => {
    const parentWindow = useParentWindow();
    const fileState = useFilePickerState();
    const handlers = useFilePickerHandlers(parentWindow, fileState);
    const [colorWidget, setColorWidget] = useState<Gtk.ColorDialogButton | null>(null);
    const [fontWidget, setFontWidget] = useState<Gtk.FontDialogButton | null>(null);
    const [fileButtonWidget, setFileButtonWidget] = useState<Gtk.Button | null>(null);
    const [uriButtonWidget, setUriButtonWidget] = useState<Gtk.Button | null>(null);

    return (
        <GtkGrid rowSpacing={6} columnSpacing={6} marginStart={20} marginEnd={20} marginTop={20} marginBottom={20}>
            <ColorPickerRow colorWidget={colorWidget} setColorWidget={setColorWidget} />
            <FontPickerRow fontWidget={fontWidget} setFontWidget={setFontWidget} />
            <FilePickerRow
                fileState={fileState}
                handlers={handlers}
                fileButtonWidget={fileButtonWidget}
                setFileButtonWidget={setFileButtonWidget}
            />
            <UriPickerRow
                uriButtonWidget={uriButtonWidget}
                setUriButtonWidget={setUriButtonWidget}
                onLaunchUri={handlers.handleLaunchUri}
            />
        </GtkGrid>
    );
};

export const pickersDemo: Demo = {
    id: "pickers",
    title: "Pickers and Launchers",
    description:
        "The dialogs are mainly intended for use in preference dialogs. They allow to select colors, fonts and files. There is also a print dialog.\n\nThe launchers let you open files or URIs in applications that can handle them.",
    keywords: [
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
