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
import { type ReactNode, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./pickers.tsx?raw";

type FilePickerState = ReturnType<typeof useFilePickerState>;
type PickerHandlers = ReturnType<typeof useFilePickerHandlers>;

type PickerLabelProps = {
    row: number;
    target: Gtk.Widget | null;
    children: ReactNode;
};

type ColorRowProps = {
    colorWidget: Gtk.ColorDialogButton | null;
    setColorWidget: (w: Gtk.ColorDialogButton | null) => void;
};

type FontRowProps = {
    fontWidget: Gtk.FontDialogButton | null;
    setFontWidget: (w: Gtk.FontDialogButton | null) => void;
};

type FileActionButtonsProps = {
    fileState: FilePickerState;
    handlers: PickerHandlers;
};

type FilePickerRowProps = FileActionButtonsProps & {
    fileButtonWidget: Gtk.Button | null;
    setFileButtonWidget: (w: Gtk.Button | null) => void;
};

type UriRowProps = {
    uriButtonWidget: Gtk.Button | null;
    setUriButtonWidget: (w: Gtk.Button | null) => void;
    onLaunchUri: () => Promise<void>;
};

const gfileType = Gio.File.prototype.__type__;
const DIALOG_TIMEOUT_SECONDS = 20;

const pickersDemo: Demo = {
    id: "pickers",
    title: "Pickers and Launchers",
    description:
        "The dialogs are mainly intended for use in preference dialogs. They allow to select colors, fonts and " +
        "files. There is also a print dialog.\n\nThe launchers let you open files or URIs in applications that can " +
        "handle them.",
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

const isCancellation = (error: unknown): boolean =>
    (error instanceof Gtk.DialogError &&
        (error.code === Gtk.DialogError.DISMISSED || error.code === Gtk.DialogError.CANCELLED)) ||
        (error instanceof Gio.IOErrorEnum && error.code === Gio.IOErrorEnum.CANCELLED);

const reportPickerError = (error: unknown): void => {
    if (isCancellation(error)) {
        return;
    }

    if (error instanceof Error) {
        console.error(error.message);
    }
};

const runWithTimeout = async (action: (cancellable: Gio.Cancellable) => Promise<void>) => {
    const cancellable = new Gio.Cancellable();

    const timeoutId = setTimeout(() => {
        cancellable.cancel();
    }, DIALOG_TIMEOUT_SECONDS * 1000);

    try {
        await action(cancellable);
    } finally {
        clearTimeout(timeoutId);
    }
};

const launchFile = async (selectedFile: Gio.File | null, action: (launcher: Gtk.FileLauncher) => Promise<void>) => {
    if (!selectedFile) {
        return;
    }

    try {
        const launcher = Gtk.FileLauncher.new(selectedFile);
        await action(launcher);
    } catch (error) {
        reportPickerError(error);
    }
};

const didAcceptFileDrop = (value: GObject.Value, setFile: (file: Gio.File) => void): boolean => {
    if (!GObject.typeCheckValueHolds(value, gfileType)) {
        return false;
    }

    const file = value.getObject();

    if (file && file instanceof Gio.File) {
        setFile(file);

        return true;
    }

    return false;
};

const clearFileSelection = (error: unknown, state: FilePickerState): void => {
    if (isCancellation(error)) {
        return;
    }

    reportPickerError(error);
    state.setSelectedFile(null);
    state.setFileName("None");
    state.setIsPdf(false);
};

const requestFile = async (
    parentWindow: Gtk.Window | null,
    cancellable: Gio.Cancellable,
    state: FilePickerState,
) => {
    const fileDialog = new Gtk.FileDialog();

    try {
        const file = await fileDialog.open(parentWindow, cancellable);
        state.setFile(file);
    } catch (error) {
        clearFileSelection(error, state);
    }
};

const openFile = (parentWindow: Gtk.Window | null, state: FilePickerState) =>
    runWithTimeout(async (cancellable) => {
        await requestFile(parentWindow, cancellable, state);
    });

const launchApp = (parentWindow: Gtk.Window | null, selectedFile: Gio.File | null) =>
    launchFile(selectedFile, async (l) => {
        await l.launch(parentWindow, null);
    });

const openFolder = (parentWindow: Gtk.Window | null, selectedFile: Gio.File | null) =>
    launchFile(selectedFile, async (l) => {
        await l.openContainingFolder(parentWindow, null);
    });

const runPrintDialog = async (parentWindow: Gtk.Window | null, file: Gio.File, cancellable: Gio.Cancellable) => {
    try {
        const printDialog = new Gtk.PrintDialog();
        await printDialog.printFile(parentWindow, null, file, cancellable);
    } catch (error) {
        reportPickerError(error);
    }
};

const printFile = async (parentWindow: Gtk.Window | null, state: FilePickerState) => {
    const { selectedFile, isPdf } = state;

    if (!selectedFile || !isPdf) {
        return;
    }

    await runWithTimeout(async (cancellable) => {
        await runPrintDialog(parentWindow, selectedFile, cancellable);
    });
};

const launchUri = async (parentWindow: Gtk.Window | null) => {
    try {
        const launcher = Gtk.UriLauncher.new("https://www.gtk.org");
        await launcher.launch(parentWindow, null);
    } catch (error) {
        reportPickerError(error);
    }
};

function useFilePickerState() {
    const [selectedFile, setSelectedFile] = useState<Gio.File | null>(null);
    const [fileName, setFileName] = useState("None");
    const [isPdf, setIsPdf] = useState(false);

    const setFile = (file: Gio.File) => {
        setSelectedFile(file);
        setFileName(file.getBasename() ?? file.getUri());
        const info = file.queryInfo("standard::content-type", 0, null);
        setIsPdf(info.getContentType() === "application/pdf");
    };

    return { selectedFile, setSelectedFile, fileName, setFileName, isPdf, setIsPdf, setFile };
}

function useFilePickerHandlers(parentWindow: Gtk.Window | null, state: FilePickerState) {
    return {
        handleFileDrop: (value: GObject.Value) => didAcceptFileDrop(value, state.setFile),
        handleOpenFile: () => openFile(parentWindow, state),
        handleLaunchApp: () => launchApp(parentWindow, state.selectedFile),
        handleOpenFolder: () => openFolder(parentWindow, state.selectedFile),
        handlePrintFile: () => printFile(parentWindow, state),
        handleLaunchUri: () => launchUri(parentWindow),
    };
}

const PickerLabel = ({ row, target, children }: PickerLabelProps) => (
    <GtkGridLayoutChild column={0} row={row}>
        <GtkLabel useUnderline halign={Gtk.Align.START} valign={Gtk.Align.CENTER} hexpand mnemonicWidget={target}>
            {children}
        </GtkLabel>
    </GtkGridLayoutChild>
);

const ColorPickerRow = ({ colorWidget, setColorWidget }: ColorRowProps) => (
    <>
        <PickerLabel row={0} target={colorWidget}>
            _Color:
        </PickerLabel>
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

const FontPickerRow = ({ fontWidget, setFontWidget }: FontRowProps) => (
    <>
        <PickerLabel row={1} target={fontWidget}>
            _Font:
        </PickerLabel>
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

const FileActionButtons = ({ fileState, handlers }: FileActionButtonsProps) => (
    <>
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
    </>
);

const FilePickerRow = ({ fileState, handlers, fileButtonWidget, setFileButtonWidget }: FilePickerRowProps) => (
    <>
        <PickerLabel row={2} target={fileButtonWidget}>
            _File:
        </PickerLabel>
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
                    controllers={(
                        <GtkDropTarget
                            types={[gfileType]}
                            actions={Gdk.DragAction.COPY}
                            onDrop={handlers.handleFileDrop}
                        />
                    )}
                />
                <FileActionButtons fileState={fileState} handlers={handlers} />
            </GtkBox>
        </GtkGridLayoutChild>
    </>
);

const UriPickerRow = ({ uriButtonWidget, setUriButtonWidget, onLaunchUri }: UriRowProps) => (
    <>
        <PickerLabel row={3} target={uriButtonWidget}>
            _URI:
        </PickerLabel>
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

function PickersDemo() {
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
}

export { pickersDemo };
