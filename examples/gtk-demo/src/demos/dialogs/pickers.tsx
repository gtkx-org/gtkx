import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import {
    GtkBox,
    GtkButton,
    GtkColorDialog,
    GtkColorDialogButton,
    GtkDropTarget,
    GtkFileDialog,
    GtkFileLauncher,
    GtkFontDialog,
    GtkFontDialogButton,
    GtkGrid,
    GtkGridLayoutChild,
    GtkLabel,
    GtkPrintDialog,
    GtkUriLauncher,
} from "@gtkx/jsx/gtk";
import { createPortal, rootElement, useParentWindow } from "@gtkx/react";
import { type ReactNode, useEffect, useEffectEvent, useState } from "react";
import type { Demo } from "../types.js";
import { isCancellation } from "../../is-cancellation.js";
import { type CancellableHandle, useCancellable } from "../../use-cancellable.js";
import sourceCode from "./pickers.tsx?raw";

type FilePickerState = ReturnType<typeof useFilePickerState>;
type PickerHandlers = ReturnType<typeof useFilePickerHandlers>;

type PickerObjects = {
    fileDialog: Gtk.FileDialog | null;
    fileLauncher: Gtk.FileLauncher | null;
    printDialog: Gtk.PrintDialog | null;
    uriLauncher: Gtk.UriLauncher | null;
};

type PickerCancellables = {
    openFile: CancellableHandle;
    launchApp: CancellableHandle;
    openFolder: CancellableHandle;
    printFile: CancellableHandle;
    launchUri: CancellableHandle;
};

type OpenFileRequest = {
    fileDialog: Gtk.FileDialog;
    parentWindow: Gtk.Window | null;
    cancellable: Gio.Cancellable;
    state: FilePickerState;
    renewCancellable: () => void;
};

type PrintFileRequest = {
    printDialog: Gtk.PrintDialog;
    parentWindow: Gtk.Window | null;
    cancellable: Gio.Cancellable;
    state: FilePickerState;
    renewCancellable: () => void;
};

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

const reportPickerError = (failure: unknown, receive: (message: string) => void): void => {
    if (isCancellation(failure)) {
        return;
    }

    receive(failure instanceof Error ? failure.message : String(failure));
};

const gfileType = Gio.File.prototype.__type__;

const pickersDemo: Demo = {
    id: "pickers",
    title: "Pickers and Launchers",
    description:
        "Generated GTKX dialogs choose colors, fonts and files or start a print job. Launchers open selected " +
        "files, their folders and web addresses with installed applications.",
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

const launchFile = async (
    launcher: Gtk.FileLauncher | null,
    handle: CancellableHandle,
    action: (launcher: Gtk.FileLauncher, cancellable: Gio.Cancellable) => Promise<void>,
    onError: (error: unknown) => void,
) => {
    const { cancellable } = handle;
    if (launcher === null || cancellable === null) {
        return;
    }

    try {
        await action(launcher, cancellable);
    } catch (error) {
        onError(error);
    } finally {
        handle.renew();
    }
};

const didAcceptFileDrop = (value: GObject.Value, setFile: (file: Gio.File) => void): boolean => {
    if (!GObject.typeCheckValueHolds(value, gfileType)) {
        return false;
    }

    const file = value.getObject();

    if (file instanceof Gio.File) {
        setFile(file);

        return true;
    }

    return false;
};

const requestFile = async (
    fileDialog: Gtk.FileDialog,
    parentWindow: Gtk.Window | null,
    cancellable: Gio.Cancellable,
    state: FilePickerState,
) => {
    try {
        const file = await fileDialog.open(parentWindow, cancellable);
        state.setFile(file);
    } catch (error) {
        state.reportError(error);
    }
};

const openFile = async ({ fileDialog, parentWindow, cancellable, state, renewCancellable }: OpenFileRequest) => {
    try {
        await requestFile(fileDialog, parentWindow, cancellable, state);
    } finally {
        renewCancellable();
    }
};

const launchApp = (
    parentWindow: Gtk.Window | null,
    launcher: Gtk.FileLauncher | null,
    cancellable: CancellableHandle,
    onError: (error: unknown) => void,
) =>
    launchFile(
        launcher,
        cancellable,
        async (current, currentCancellable) => {
            await current.launch(parentWindow, currentCancellable);
        },
        onError,
    );

const openFolder = (
    parentWindow: Gtk.Window | null,
    launcher: Gtk.FileLauncher | null,
    cancellable: CancellableHandle,
    onError: (error: unknown) => void,
) =>
    launchFile(
        launcher,
        cancellable,
        async (current, currentCancellable) => {
            await current.openContainingFolder(parentWindow, currentCancellable);
        },
        onError,
    );

const printFile = async ({ printDialog, parentWindow, cancellable, state, renewCancellable }: PrintFileRequest) => {
    const { selectedFile, isPdf } = state;

    if (!selectedFile || !isPdf) {
        return;
    }

    try {
        await printDialog.printFile(parentWindow, null, selectedFile, cancellable);
    } catch (error) {
        state.reportError(error);
    } finally {
        renewCancellable();
    }
};

const launchUri = async (
    parentWindow: Gtk.Window | null,
    launcher: Gtk.UriLauncher | null,
    cancellable: CancellableHandle,
    onError: (error: unknown) => void,
) => {
    if (launcher === null || cancellable.cancellable === null) {
        return;
    }

    try {
        await launcher.launch(parentWindow, cancellable.cancellable);
    } catch (error) {
        onError(error);
    } finally {
        cancellable.renew();
    }
};

type SelectedFile = { file: Gio.File; isPdf: boolean };

type FileMetadataProps = {
    file: Gio.File;
    onSelected: (selection: SelectedFile) => void;
    onError: (error: unknown) => void;
};

function FileMetadata({ file, onSelected, onError }: FileMetadataProps) {
    const { cancellable, element } = useCancellable();
    const reportResult = useEffectEvent((info: Gio.FileInfo) => {
        const contentType = info.getContentType();
        onSelected({ file, isPdf: contentType !== null && Gio.contentTypeIsA(contentType, "application/pdf") });
    });
    const reportError = useEffectEvent(onError);

    useEffect(() => {
        if (cancellable === null) {
            return;
        }

        const flags = Gio.FileQueryInfoFlags.NONE;
        void file.queryInfoAsync("standard::content-type", flags, GLib.PRIORITY_DEFAULT, cancellable)
            .then((info) => {
                if (!cancellable.isCancelled()) {
                    reportResult(info);
                }

                return null;
            })
            .catch((error: unknown) => {
                if (!cancellable.isCancelled()) {
                    reportError(error);
                }
            });
    }, [file, cancellable]);

    return createPortal(element, rootElement);
}

function useFilePickerState() {
    const [selection, setSelection] = useState<SelectedFile | null>(null);
    const [pending, setPending] = useState<{ file: Gio.File; id: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const reportError = (failure: unknown) => {
        reportPickerError(failure, setError);
    };
    const element = (
        <>
            {pending !== null && (
                <FileMetadata
                    key={pending.id}
                    file={pending.file}
                    onSelected={(value) => {
                        setSelection(value);
                        setPending(null);
                    }}
                    onError={(failure) => {
                        reportPickerError(failure, (message) => {
                            setPending(null);
                            setError(message);
                        });
                    }}
                />
            )}
            {error !== null && (
                <AdwAlertDialog
                    heading="Could not complete the operation"
                    body={error}
                    responses={[{ id: "ok", label: "_OK" }]}
                    closeResponse="ok"
                    defaultResponse="ok"
                    onClosed={() => {
                        setError(null);
                    }}
                />
            )}
        </>
    );

    return {
        selectedFile: selection?.file ?? null,
        fileName: selection === null ? "None" : selection.file.getBasename() ?? selection.file.getUri(),
        isPdf: selection?.isPdf ?? false,
        setFile: (file: Gio.File) => {
            setPending({ file, id: crypto.randomUUID() });
        },
        reportError,
        element,
    };
}

function useFilePickerHandlers(
    parentWindow: Gtk.Window | null,
    state: FilePickerState,
    objects: PickerObjects,
    cancellables: PickerCancellables,
) {
    return {
        handleFileDrop: (value: GObject.Value) => didAcceptFileDrop(value, state.setFile),
        handleOpenFile: () =>
            objects.fileDialog !== null && cancellables.openFile.cancellable !== null
                ? openFile({
                        fileDialog: objects.fileDialog,
                        parentWindow,
                        cancellable: cancellables.openFile.cancellable,
                        state,
                        renewCancellable: cancellables.openFile.renew,
                    })
                : Promise.resolve(),
        handleLaunchApp: () => launchApp(parentWindow, objects.fileLauncher, cancellables.launchApp, state.reportError),
        handleOpenFolder: () =>
            openFolder(parentWindow, objects.fileLauncher, cancellables.openFolder, state.reportError),
        handlePrintFile: () =>
            objects.printDialog !== null && cancellables.printFile.cancellable !== null
                ? printFile({
                        printDialog: objects.printDialog,
                        parentWindow,
                        cancellable: cancellables.printFile.cancellable,
                        state,
                        renewCancellable: cancellables.printFile.renew,
                    })
                : Promise.resolve(),
        handleLaunchUri: () => launchUri(parentWindow, objects.uriLauncher, cancellables.launchUri, state.reportError),
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
            tooltipText="Open File"
            halign={Gtk.Align.END}
            sensitive={fileState.selectedFile !== null}
            onClicked={() => void handlers.handleLaunchApp()}
        />
        <GtkButton
            name="open-folder-button"
            iconName="folder-symbolic"
            accessibleLabel="Open in Folder"
            accessibleHasPopup
            tooltipText="Open in Folder"
            halign={Gtk.Align.END}
            sensitive={fileState.selectedFile !== null}
            onClicked={() => void handlers.handleOpenFolder()}
        />
        <GtkButton
            name="print-button"
            iconName="printer-symbolic"
            accessibleLabel="Print File"
            accessibleHasPopup
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
                <GtkLabel xalign={0} ellipsize={Pango.EllipsizeMode.END} hexpand>
                    {fileState.fileName}
                </GtkLabel>
                <GtkButton
                    name="select-file-button"
                    ref={setFileButtonWidget}
                    iconName="document-open-symbolic"
                    accessibleLabel="Select File"
                    accessibleHasPopup
                    tooltipText="Select File"
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

function usePickerObjects(selectedFile: Gio.File | null) {
    const [fileDialog, setFileDialog] = useState<Gtk.FileDialog | null>(null);
    const [fileLauncher, setFileLauncher] = useState<Gtk.FileLauncher | null>(null);
    const [printDialog, setPrintDialog] = useState<Gtk.PrintDialog | null>(null);
    const [uriLauncher, setUriLauncher] = useState<Gtk.UriLauncher | null>(null);
    const openFile = useCancellable();
    const launchApp = useCancellable();
    const openFolder = useCancellable();
    const printFile = useCancellable();
    const launchUri = useCancellable();

    const portal = createPortal(
        <>
            <GtkFileDialog ref={setFileDialog} />
            {selectedFile !== null && <GtkFileLauncher ref={setFileLauncher} file={selectedFile} />}
            <GtkPrintDialog ref={setPrintDialog} />
            <GtkUriLauncher ref={setUriLauncher} uri="https://www.gtk.org" />
            {openFile.element}
            {launchApp.element}
            {openFolder.element}
            {printFile.element}
            {launchUri.element}
        </>,
        rootElement,
    );

    return {
        objects: { fileDialog, fileLauncher, printDialog, uriLauncher },
        cancellables: { openFile, launchApp, openFolder, printFile, launchUri },
        portal,
    };
}

function PickersDemo() {
    const parentWindow = useParentWindow();
    const fileState = useFilePickerState();
    const [colorWidget, setColorWidget] = useState<Gtk.ColorDialogButton | null>(null);
    const [fontWidget, setFontWidget] = useState<Gtk.FontDialogButton | null>(null);
    const [fileButtonWidget, setFileButtonWidget] = useState<Gtk.Button | null>(null);
    const [uriButtonWidget, setUriButtonWidget] = useState<Gtk.Button | null>(null);
    const { objects, cancellables, portal } = usePickerObjects(fileState.selectedFile);
    const handlers = useFilePickerHandlers(parentWindow, fileState, objects, cancellables);

    return (
        <>
            {portal}
            {fileState.element}
            <GtkGrid
                rowSpacing={6}
                columnSpacing={6}
                marginStart={20}
                marginEnd={20}
                marginTop={20}
                marginBottom={20}
            >
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
        </>
    );
}

export { pickersDemo };
