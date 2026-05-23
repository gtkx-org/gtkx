import * as Gdk from "@gtkx/ffi/gdk";
import * as Gio from "@gtkx/ffi/gio";
import type { GType } from "@gtkx/ffi/gobject";
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
} from "@gtkx/react";
import { useCallback, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./pickers.tsx?raw";

let gFileTypeCache: GType | null = null;
const getGFileType = (): GType => {
    gFileTypeCache ??= GObject.typeFromName("GFile");
    return gFileTypeCache;
};

const DIALOG_TIMEOUT_SECONDS = 20;

function useFilePickerState() {
    const [selectedFile, setSelectedFile] = useState<Gio.File | null>(null);
    const [fileName, setFileName] = useState("None");
    const [isPdf, setIsPdf] = useState(false);

    const setFile = useCallback((file: Gio.File) => {
        setSelectedFile(file);
        setFileName(file.getBasename() ?? file.getUri() ?? "");
        const info = file.queryInfo("standard::content-type", 0, null);
        setIsPdf(info.getContentType() === "application/pdf");
    }, []);

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
        if (e instanceof Error) console.error(e.message);
    }
};

function useDropAndOpenHandlers(window: React.RefObject<Gtk.Window | null>, state: FilePickerState) {
    const { setFile, setSelectedFile, setFileName, setIsPdf } = state;

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
        await runWithTimeout(async (cancellable) => {
            const fileDialog = new Gtk.FileDialog();
            try {
                const file = await fileDialog.open(window.current, cancellable);
                setFile(file);
            } catch (e) {
                if (e instanceof Error) console.error(e.message);
                setSelectedFile(null);
                setFileName("None");
                setIsPdf(false);
            }
        });
    };

    return { handleFileDrop, handleOpenFile };
}

function useFileLaunchHandlers(window: React.RefObject<Gtk.Window | null>, state: FilePickerState) {
    const { selectedFile, isPdf } = state;

    const handleLaunchApp = useCallback(
        () =>
            launchFile(selectedFile, async (l) => {
                await l.launch(window.current, null);
            }),
        [window, selectedFile],
    );

    const handleOpenFolder = useCallback(
        () =>
            launchFile(selectedFile, async (l) => {
                await l.openContainingFolder(window.current, null);
            }),
        [window, selectedFile],
    );

    const handlePrintFile = useCallback(async () => {
        if (!selectedFile || !isPdf) return;
        await runWithTimeout(async (cancellable) => {
            try {
                const printDialog = new Gtk.PrintDialog();
                await printDialog.printFile(window.current, null, selectedFile, cancellable);
            } catch (e) {
                if (e instanceof Error) console.error(e.message);
            }
        });
    }, [window, selectedFile, isPdf]);

    const handleLaunchUri = useCallback(async () => {
        try {
            const launcher = Gtk.UriLauncher.new("http://www.gtk.org");
            await launcher.launch(window.current, null);
        } catch (e) {
            if (e instanceof Error) console.error(e.message);
        }
    }, [window]);

    return { handleLaunchApp, handleOpenFolder, handlePrintFile, handleLaunchUri };
}

function useFilePickerHandlers(window: React.RefObject<Gtk.Window | null>, state: FilePickerState) {
    const dropAndOpen = useDropAndOpenHandlers(window, state);
    const launch = useFileLaunchHandlers(window, state);
    return { ...dropAndOpen, ...launch };
}

interface ColorRowProps {
    colorWidget: Gtk.ColorDialogButton | null;
    setColorWidget: (w: Gtk.ColorDialogButton | null) => void;
}

const ColorPickerRow = ({ colorWidget, setColorWidget }: ColorRowProps) => (
    <>
        <GtkGrid.Child column={0} row={0}>
            <GtkLabel
                label="_Color:"
                useUnderline
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
                mnemonicWidget={colorWidget}
            />
        </GtkGrid.Child>
        <GtkGrid.Child column={1} row={0}>
            <GtkColorDialogButton name="color-button" ref={setColorWidget} />
        </GtkGrid.Child>
    </>
);

interface FontRowProps {
    fontWidget: Gtk.FontDialogButton | null;
    setFontWidget: (w: Gtk.FontDialogButton | null) => void;
}

const FontPickerRow = ({ fontWidget, setFontWidget }: FontRowProps) => (
    <>
        <GtkGrid.Child column={0} row={1}>
            <GtkLabel
                label="_Font:"
                useUnderline
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
                mnemonicWidget={fontWidget}
            />
        </GtkGrid.Child>
        <GtkGrid.Child column={1} row={1}>
            <GtkFontDialogButton name="font-button" ref={setFontWidget} />
        </GtkGrid.Child>
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
        <GtkGrid.Child column={0} row={2}>
            <GtkLabel
                label="_File:"
                useUnderline
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
                mnemonicWidget={fileButtonWidget}
            />
        </GtkGrid.Child>
        <GtkGrid.Child column={1} row={2}>
            <GtkBox spacing={6}>
                <GtkLabel label={fileState.fileName} xalign={0} ellipsize={2} hexpand />
                <GtkButton
                    name="select-file-button"
                    ref={setFileButtonWidget}
                    iconName="document-open-symbolic"
                    accessibleLabel="Select File"
                    accessibleHasPopup
                    onClicked={() => void handlers.handleOpenFile()}
                >
                    <GtkDropTarget
                        types={[getGFileType()]}
                        actions={Gdk.DragAction.COPY}
                        onDrop={handlers.handleFileDrop}
                    />
                </GtkButton>
                <GtkButton
                    name="open-file-button"
                    iconName="system-run-symbolic"
                    accessibleLabel="Open File"
                    accessibleHasPopup
                    sensitive={fileState.selectedFile !== null}
                    onClicked={() => void handlers.handleLaunchApp()}
                />
                <GtkButton
                    name="open-folder-button"
                    iconName="folder-symbolic"
                    accessibleLabel="Open in Folder"
                    accessibleHasPopup
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
        </GtkGrid.Child>
    </>
);

interface UriRowProps {
    uriButtonWidget: Gtk.Button | null;
    setUriButtonWidget: (w: Gtk.Button | null) => void;
    onLaunchUri: () => Promise<void>;
}

const UriPickerRow = ({ uriButtonWidget, setUriButtonWidget, onLaunchUri }: UriRowProps) => (
    <>
        <GtkGrid.Child column={0} row={3}>
            <GtkLabel
                label="_URI:"
                useUnderline
                halign={Gtk.Align.START}
                valign={Gtk.Align.CENTER}
                hexpand
                mnemonicWidget={uriButtonWidget}
            />
        </GtkGrid.Child>
        <GtkGrid.Child column={1} row={3}>
            <GtkButton
                ref={setUriButtonWidget}
                label="www.gtk.org"
                accessibleLabel="Open www.gtk.org"
                accessibleHasPopup
                onClicked={() => void onLaunchUri()}
            />
        </GtkGrid.Child>
    </>
);

const PickersDemo = ({ window }: DemoProps) => {
    const fileState = useFilePickerState();
    const handlers = useFilePickerHandlers(window, fileState);
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
