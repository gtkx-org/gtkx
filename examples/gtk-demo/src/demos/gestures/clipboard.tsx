import type { Context } from "@gtkx/cairo";
import type { JsValue } from "@gtkx/runtime";
import { DropDown } from "@gtkx/components";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkColorDialog,
    GtkColorDialogButton,
    GtkDragSource,
    GtkDrawingArea,
    GtkDropTarget,
    GtkEntry,
    GtkFileDialog,
    GtkImage,
    GtkLabel,
    GtkSeparator,
    GtkStack,
    GtkStackPage,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { createPortal, rootElement, useParentWindow, useProperty } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import floppyBuddyPath from "../../../data/demos/gestures/floppybuddy.gif?resource";
import portlandRosePath from "../../../data/demos/gestures/portland-rose.jpg?resource";
import demo4LogoPath from "../../../data/icons/org.gtk.Demo4.svg?resource";
import { buildRgba } from "../../build-rgba.js";
import { isCancellation } from "../../is-cancellation.js";
import { useCancellable } from "../../use-cancellable.js";
import sourceCode from "./clipboard.tsx?raw";

type SourceType = "Text" | "Color" | "Image" | "File" | "Folder";
type ImageIndex = 0 | 1 | 2;
type PastedContentType = "" | "Text" | "Color" | "Image" | "File";
type SetPastedContent = React.Dispatch<React.SetStateAction<PastedContent>>;
type ClipboardState = ReturnType<typeof useClipboardState>;
type ClipboardTextures = ReturnType<typeof useClipboardTextures>;

type PastedContent = {
    type: PastedContentType;
    text?: string;
    color?: Gdk.RGBA;
    paintable?: Gdk.Paintable;
    filePath?: string;
};

type CopySourceArgs = {
    sourceType: SourceType;
    sourceText: string;
    sourceColor: Gdk.RGBA;
    selectedImage: ImageIndex;
    sourceFile: Gio.File | null;
    sourceFolder: Gio.File | null;
};

type PasteAttempt = (
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
) => Promise<boolean>;

type ClipboardSourceSectionProps = {
    state: ClipboardState;
    textures: ReturnType<typeof useClipboardTextures>;
    providers: ReturnType<typeof useDragProviders>;
    onCopy: () => void;
    onFileSelect: () => void;
    onFolderSelect: () => void;
};

type SourcePageImageProps = {
    state: ClipboardState;
    textures: ReturnType<typeof useClipboardTextures>;
};

type ImageToggleProps = {
    name: string;
    buttonLabel: string;
    imageLabel: string;
    index: ImageIndex;
    state: ClipboardState;
    paintable: Gdk.Texture;
    group?: Gtk.ToggleButton | null;
    toggleRef?: React.Ref<Gtk.ToggleButton>;
};

type SourcePageFileProps = {
    id: "File" | "Folder";
    label: string;
    file: Gio.File | null;
    onClick: () => void;
    createFileDragProvider: () => Gdk.ContentProvider | null;
};

type ClipboardPasteSectionProps = {
    pastedContent: PastedContent;
    canPaste: boolean;
    onPaste: () => Promise<void>;
    onDrop: (value: GObject.Value) => boolean;
};

type FileDialogRequest = {
    dialog: Gtk.FileDialog;
    window: Gtk.Window | null;
    cancellable: Gio.Cancellable;
    kind: "file" | "folder";
    setSource: (file: Gio.File) => void;
};

type ClipboardDialogObjects = {
    parentWindow: Gtk.Window | null;
    file: ClipboardFileDialog;
    folder: ClipboardFileDialog;
};

type ClipboardFileDialog = {
    dialog: Gtk.FileDialog | null;
    cancellable: Gio.Cancellable | null;
    renew: () => void;
};

const gdkRgbaType = Gdk.RGBA.prototype.__type__;
const gdkPaintableType = Gdk.Paintable.prototype.__type__;
const gfileType = Gio.File.prototype.__type__;
const gdkTextureType = Gdk.Texture.prototype.__type__;
const SOURCE_TYPES: SourceType[] = ["Text", "Color", "Image", "File", "Folder"];
const PASTE_ATTEMPTS: PasteAttempt[] = [tryPasteTexture, tryPastePaintable, tryPasteColor, tryPasteFile, tryPasteText];

const clipboardDemo: Demo = {
    id: "clipboard",
    title: "Clipboard",
    description:
        "Copy and paste text, images, colors and files with GdkClipboard. The same content can be dragged from " +
        "the source to the target.",
    keywords: ["drag-and-drop", "dnd"],
    component: ClipboardDemo,
    sourceCode,
};

const logError = (error: unknown) => {
    if (!isCancellation(error) && error instanceof Error) {
        console.error(error.message);
    }
};

const setClipboardValue = (clipboard: Gdk.Clipboard, value: GObject.Value | JsValue): void => {
    clipboard.set(value);
};

const readTextureAsync = (clipboard: Gdk.Clipboard): Promise<Gdk.Texture | null> => clipboard.readTextureAsync(null);

const readValueAsync = (clipboard: Gdk.Clipboard, type: GObject.Type): Promise<unknown> =>
    clipboard.readValueAsync(type, 0, null);

function drawColorSwatch(cr: Context, width: number, height: number, rgba: Gdk.RGBA): void {
    cr.setSourceRgba(rgba.red, rgba.green, rgba.blue, rgba.alpha);
    cr.rectangle(0, 0, width, height);
    cr.fill();
}

const didApplyColor = (rgba: Gdk.RGBA, setPastedContent: SetPastedContent): boolean => {
    setPastedContent({ type: "Color", color: buildRgba(rgba.red, rgba.green, rgba.blue, rgba.alpha) });

    return true;
};

const canCopySource = (
    sourceType: SourceType,
    sourceText: string,
    sourceFile: Gio.File | null,
    sourceFolder: Gio.File | null,
): boolean => {
    if (sourceType === "Text") {
        return sourceText.length > 0;
    }

    if (sourceType === "File") {
        return sourceFile !== null;
    }

    if (sourceType === "Folder") {
        return sourceFolder !== null;
    }

    return true;
};

function useClipboardState() {
    const [sourceType, setSourceType] = useState<SourceType>("Text");
    const [sourceText, setSourceText] = useState("Copy this!");
    const [sourceColor, setSourceColor] = useState<Gdk.RGBA>(buildRgba(128 / 255, 0, 128 / 255, 1));
    const [selectedImage, setSelectedImage] = useState<ImageIndex>(0);
    const [sourceFile, setSourceFile] = useState<Gio.File | null>(null);
    const [sourceFolder, setSourceFolder] = useState<Gio.File | null>(null);
    const [pastedContent, setPastedContent] = useState<PastedContent>({ type: "" });
    const canCopy = canCopySource(sourceType, sourceText, sourceFile, sourceFolder);

    return {
        sourceType,
        setSourceType,
        sourceText,
        setSourceText,
        sourceColor,
        setSourceColor,
        selectedImage,
        setSelectedImage,
        sourceFile,
        setSourceFile,
        sourceFolder,
        setSourceFolder,
        pastedContent,
        setPastedContent,
        canCopy,
    };
}

function useClipboardTextures() {
    const [portlandRoseTexture] = useState(() => Gdk.Texture.newFromResource(portlandRosePath));
    const [floppyBuddyTexture] = useState(() => Gdk.Texture.newFromResource(floppyBuddyPath));
    const [demo4LogoTexture] = useState(() => Gdk.Texture.newFromResource(demo4LogoPath));

    return { portlandRoseTexture, floppyBuddyTexture, demo4LogoTexture };
}

const getClipboard = () => Gdk.Display.getDefault()?.getClipboard() ?? null;

const canPasteFrom = (formats: Gdk.ContentFormats): boolean =>
    formats.containGtype(GObject.TYPE_STRING) ||
    formats.containGtype(gdkRgbaType) ||
    formats.containGtype(gdkPaintableType) ||
    formats.containGtype(gfileType) ||
    formats.containMimeType("image/png");

const textureValue = (texture: Gdk.Texture): GObject.Value => {
    const value = new GObject.Value();
    value.init(gdkTextureType);
    value.setObject(texture);

    return value;
};

const textureProvider = (texture: Gdk.Texture): Gdk.ContentProvider =>
    Gdk.ContentProvider.newForValue(textureValue(texture));

const fileValue = (file: Gio.File): GObject.Value => {
    const value = new GObject.Value();
    value.init(gfileType);
    value.setObject(file);

    return value;
};

const textureForIndex = (index: ImageIndex, textures: ClipboardTextures): Gdk.Texture =>
    ([textures.portlandRoseTexture, textures.floppyBuddyTexture, textures.demo4LogoTexture] as const)[index];

function useDragProviders(state: ClipboardState) {
    const { sourceText, sourceColor, sourceFile, sourceFolder } = state;
    const createTextDragProvider = () => Gdk.ContentProvider.newForValue(sourceText);
    const createColorDragProvider = () => Gdk.ContentProvider.newForValue(sourceColor);
    const createFileDragProvider = () =>
        sourceFile ? Gdk.ContentProvider.newForValue(fileValue(sourceFile)) : null;
    const createFolderDragProvider = () =>
        sourceFolder ? Gdk.ContentProvider.newForValue(fileValue(sourceFolder)) : null;

    return { createTextDragProvider, createColorDragProvider, createFileDragProvider, createFolderDragProvider };
}

const copyTextToClipboard = (clipboard: Gdk.Clipboard, sourceText: string) => {
    setClipboardValue(clipboard, sourceText);
};

const copyColorToClipboard = (clipboard: Gdk.Clipboard, sourceColor: Gdk.RGBA) => {
    setClipboardValue(clipboard, sourceColor);
};

const copyImageToClipboard = (clipboard: Gdk.Clipboard, selectedImage: ImageIndex, textures: ClipboardTextures) => {
    clipboard.setContent(textureProvider(textureForIndex(selectedImage, textures)));
};

const copyFileToClipboard = (clipboard: Gdk.Clipboard, sourceFile: Gio.File | null) => {
    if (sourceFile) {
        setClipboardValue(clipboard, fileValue(sourceFile));
    }
};

const copySourceToClipboard = ({
    sourceType,
    sourceText,
    sourceColor,
    selectedImage,
    sourceFile,
    sourceFolder,
}: CopySourceArgs, textures: ClipboardTextures) => {
    const clipboard = getClipboard();

    if (!clipboard) {
        return;
    }

    switch (sourceType) {
        case "Text": {
            copyTextToClipboard(clipboard, sourceText);
            break;
        }
        case "Color": {
            copyColorToClipboard(clipboard, sourceColor);
            break;
        }
        case "Image": {
            copyImageToClipboard(clipboard, selectedImage, textures);
            break;
        }
        case "File": {
            copyFileToClipboard(clipboard, sourceFile);
            break;
        }
        case "Folder": {
            copyFileToClipboard(clipboard, sourceFolder);
            break;
        }
    }
};

const runPasteAttempts = async (
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<void> => {
    for (const attempt of PASTE_ATTEMPTS) {
        if (await attempt(clipboard, formats, setPastedContent)) {
            return;
        }
    }
};

const pasteFromClipboard = async (setPastedContent: SetPastedContent): Promise<void> => {
    const clipboard = getClipboard();

    if (!clipboard) {
        return;
    }

    try {
        await runPasteAttempts(clipboard, clipboard.getFormats(), setPastedContent);
    } catch (error) {
        logError(error);
    }
};

function useClipboardHandlers(
    state: ClipboardState,
    textures: ClipboardTextures,
    { parentWindow, file, folder }: ClipboardDialogObjects,
) {
    const { setSourceFile, setSourceFolder, setPastedContent } = state;

    const handleCopy = () => {
        copySourceToClipboard(state, textures);
    };

    const handlePaste = () => pasteFromClipboard(setPastedContent);

    const handleFileSelect = () => {
        if (file.dialog !== null && file.cancellable !== null) {
            void openFileDialog({
                dialog: file.dialog,
                window: parentWindow,
                cancellable: file.cancellable,
                kind: "file",
                setSource: setSourceFile,
            }).finally(file.renew);
        }
    };

    const handleFolderSelect = () => {
        if (folder.dialog !== null && folder.cancellable !== null) {
            void openFileDialog({
                dialog: folder.dialog,
                window: parentWindow,
                cancellable: folder.cancellable,
                kind: "folder",
                setSource: setSourceFolder,
            }).finally(folder.renew);
        }
    };

    const didHandleDrop = (value: GObject.Value) => didHandleClipboardDrop(value, setPastedContent);

    return { handleCopy, handlePaste, handleFileSelect, handleFolderSelect, didHandleDrop };
}

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether the paste succeeded */
async function tryPasteTexture(
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> {
    if (!formats.containMimeType("image/png")) {
        return false;
    }

    const texture = await readTextureAsync(clipboard);

    if (!texture) {
        return false;
    }

    setPastedContent({ type: "Image", paintable: texture });

    return true;
}

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether the paste succeeded */
async function tryPastePaintable(
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> {
    if (!formats.containGtype(gdkPaintableType)) {
        return false;
    }

    const value = await readValueAsync(clipboard, gdkPaintableType);

    if (value === null) {
        return false;
    }

    setPastedContent({ type: "Image", paintable: value as Gdk.Paintable });

    return true;
}

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether the paste succeeded */
async function tryPasteColor(
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> {
    if (!formats.containGtype(gdkRgbaType)) {
        return false;
    }

    const rgba = await readValueAsync(clipboard, gdkRgbaType);

    return rgba instanceof Gdk.RGBA && didApplyColor(rgba, setPastedContent);
}

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether the paste succeeded */
async function tryPasteFile(
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> {
    if (!formats.containGtype(gfileType)) {
        return false;
    }

    const value = await readValueAsync(clipboard, gfileType);

    if (!(value instanceof Gio.File)) {
        return false;
    }

    setPastedContent({ type: "File", filePath: value.getPath() ?? value.getUri() });

    return true;
}

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether the paste succeeded */
async function tryPasteText(
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> {
    if (!formats.containGtype(GObject.TYPE_STRING)) {
        return false;
    }

    const text = await clipboard.readTextAsync(null);

    if (text === null) {
        return false;
    }

    setPastedContent({ type: "Text", text });

    return true;
}

const openFileDialog = async ({ dialog, window, cancellable, kind, setSource }: FileDialogRequest) => {
    try {
        const file =
            kind === "file"
                ? await dialog.open(window, cancellable)
                : await dialog.selectFolder(window, cancellable);
        setSource(file);
    } catch (error) {
        logError(error);
    }
};

const didHandleObjectDrop = (value: GObject.Value, setPastedContent: SetPastedContent): boolean => {
    if (!GObject.typeCheckValueHolds(value, GObject.TYPE_OBJECT)) {
        return false;
    }

    const obj = value.getObject();

    if (!obj) {
        return false;
    }

    if (obj instanceof Gdk.Paintable) {
        setPastedContent({ type: "Image", paintable: obj });

        return true;
    }

    if (obj instanceof Gio.File) {
        setPastedContent({ type: "File", filePath: obj.getPath() ?? obj.getUri() });

        return true;
    }

    return false;
};

const didHandleColorDrop = (value: GObject.Value, setPastedContent: SetPastedContent): boolean => {
    if (!GObject.typeCheckValueHolds(value, gdkRgbaType)) {
        return false;
    }

    return didApplyColor(value.getBoxed<Gdk.RGBA>(), setPastedContent);
};

const didHandleTextDrop = (value: GObject.Value, setPastedContent: SetPastedContent): boolean => {
    if (!GObject.typeCheckValueHolds(value, GObject.TYPE_STRING)) {
        return false;
    }

    const text = value.getString();

    if (text === null) {
        return false;
    }

    setPastedContent({ type: "Text", text });

    return true;
};

const didHandleClipboardDrop = (value: GObject.Value, setPastedContent: SetPastedContent): boolean =>
    didHandleObjectDrop(value, setPastedContent) ||
    didHandleColorDrop(value, setPastedContent) ||
    didHandleTextDrop(value, setPastedContent);

const ClipboardSourceSection = ({
    state,
    textures,
    providers,
    onCopy,
    onFileSelect,
    onFolderSelect,
}: ClipboardSourceSectionProps) => (
    <GtkBox spacing={12}>
        <DropDown
            name="source-type"
            accessibleLabel="Source Type"
            valign={Gtk.Align.CENTER}
            onSelectionChanged={(id) => {
                state.setSourceType(id as SourceType);
            }}
            items={SOURCE_TYPES.map((type) => ({ id: type, value: type }))}
        />
        <GtkStack name="source-stack" visibleChildName={state.sourceType} vexpand>
            <SourcePageText state={state} createTextDragProvider={providers.createTextDragProvider} />
            <SourcePageColor state={state} createColorDragProvider={providers.createColorDragProvider} />
            <SourcePageImage state={state} textures={textures} />
            <SourcePageFile
                id="File"
                label="File Drag Source"
                file={state.sourceFile}
                onClick={onFileSelect}
                createFileDragProvider={providers.createFileDragProvider}
            />
            <SourcePageFile
                id="Folder"
                label="Folder Drag Source"
                file={state.sourceFolder}
                onClick={onFolderSelect}
                createFileDragProvider={providers.createFolderDragProvider}
            />
        </GtkStack>
        <GtkButton label="_Copy" useUnderline valign={Gtk.Align.CENTER} sensitive={state.canCopy} onClicked={onCopy} />
    </GtkBox>
);

const SourcePageText = ({
    state,
    createTextDragProvider,
}: {
    state: ClipboardState;
    createTextDragProvider: () => Gdk.ContentProvider;
}) => (
    <GtkStackPage name="Text">
        <GtkEntry
            name="source-entry"
            text={state.sourceText}
            valign={Gtk.Align.CENTER}
            accessibleLabel="Text Drag Source"
            onChanged={(entry) => {
                state.setSourceText(entry.getText());
            }}
            controllers={<GtkDragSource onPrepare={createTextDragProvider} actions={Gdk.DragAction.COPY} />}
        />
    </GtkStackPage>
);

const SourcePageColor = ({
    state,
    createColorDragProvider,
}: {
    state: ClipboardState;
    createColorDragProvider: () => Gdk.ContentProvider;
}) => (
    <GtkStackPage name="Color">
        <GtkColorDialogButton
            name="color-button"
            rgba={state.sourceColor}
            dialog={<GtkColorDialog />}
            valign={Gtk.Align.CENTER}
            accessibleLabel="Color Drag Source"
            onNotifyRgba={(rgba) => {
                if (rgba) {
                    state.setSourceColor(buildRgba(rgba.red, rgba.green, rgba.blue, rgba.alpha));
                }
            }}
            controllers={<GtkDragSource onPrepare={createColorDragProvider} actions={Gdk.DragAction.COPY} />}
        />
    </GtkStackPage>
);

function SourcePageImage({ state, textures }: SourcePageImageProps) {
    const [firstToggle, setFirstToggle] = useState<Gtk.ToggleButton | null>(null);

    return (
        <GtkStackPage name="Image">
            <GtkBox valign={Gtk.Align.CENTER} cssClasses={["linked"]}>
                <ImageToggle
                    name="image_rose"
                    buttonLabel="Photo Drag Source"
                    imageLabel="Portland Rose Photo"
                    index={0}
                    state={state}
                    paintable={textures.portlandRoseTexture}
                    toggleRef={setFirstToggle}
                />
                <ImageToggle
                    name="image_floppy"
                    buttonLabel="Icon Drag Source"
                    imageLabel="Floppy Buddy Icon"
                    index={1}
                    state={state}
                    paintable={textures.floppyBuddyTexture}
                    group={firstToggle}
                />
                <ImageToggle
                    name="image_logo"
                    buttonLabel="SVG Drag Source"
                    imageLabel="gtk-demo logo"
                    index={2}
                    state={state}
                    paintable={textures.demo4LogoTexture}
                    group={firstToggle}
                />
            </GtkBox>
        </GtkStackPage>
    );
}

const ImageToggle = ({
    name,
    buttonLabel,
    imageLabel,
    index,
    state,
    paintable,
    group,
    toggleRef,
}: ImageToggleProps) => (
    <GtkToggleButton
        name={name}
        ref={toggleRef}
        group={group}
        accessibleLabel={buttonLabel}
        active={state.selectedImage === index}
        onToggled={(btn) => {
            if (btn.getActive()) {
                state.setSelectedImage(index);
            }
        }}
        controllers={(
            <GtkDragSource onPrepare={() => textureProvider(paintable)} actions={Gdk.DragAction.COPY} />
        )}
    >
        <GtkImage accessibleLabel={imageLabel} paintable={paintable} cssClasses={["large-icons"]} />
    </GtkToggleButton>
);

const SourcePageFile = ({ id, label, file, onClick, createFileDragProvider }: SourcePageFileProps) => (
    <GtkStackPage name={id}>
        <GtkButton
            valign={Gtk.Align.CENTER}
            accessibleLabel={label}
            onClicked={() => {
                onClick();
            }}
            controllers={(
                <GtkDragSource
                    onPrepare={createFileDragProvider}
                    actions={Gdk.DragAction.COPY}
                    propagationPhase={Gtk.PropagationPhase.CAPTURE}
                />
            )}
        >
            <GtkLabel xalign={0} ellipsize={1}>
                {file ? (file.getPath() ?? file.getUri()) : "—"}
            </GtkLabel>
        </GtkButton>
    </GtkStackPage>
);

const renderPasteStackPages = (pastedContent: PastedContent) => (
    <>
        <GtkStackPage name="Empty">
            <GtkLabel></GtkLabel>
        </GtkStackPage>
        <GtkStackPage name="Text">
            <GtkLabel halign={Gtk.Align.END} valign={Gtk.Align.CENTER} xalign={0} ellipsize={3}>
                {pastedContent.text ?? ""}
            </GtkLabel>
        </GtkStackPage>
        <GtkStackPage name="Image">
            {pastedContent.paintable
                ? (
                        <GtkImage
                            paintable={pastedContent.paintable}
                            halign={Gtk.Align.END}
                            valign={Gtk.Align.CENTER}
                            pixelSize={48}
                        />
                    )
                : (
                        <GtkLabel></GtkLabel>
                    )}
        </GtkStackPage>
        <GtkStackPage name="Color">
            <GtkDrawingArea
                contentWidth={32}
                contentHeight={32}
                halign={Gtk.Align.END}
                valign={Gtk.Align.CENTER}
                drawFunc={(_self, cr, w, h) => {
                    const c = pastedContent.color;

                    if (c) {
                        drawColorSwatch(cr, w, h, c);
                    }
                }}
            />
        </GtkStackPage>
        <GtkStackPage name="File">
            <GtkLabel halign={Gtk.Align.END} valign={Gtk.Align.CENTER} xalign={0} hexpand ellipsize={1}>
                {pastedContent.filePath ?? ""}
            </GtkLabel>
        </GtkStackPage>
    </>
);

const ClipboardPasteSection = ({ pastedContent, canPaste, onPaste, onDrop }: ClipboardPasteSectionProps) => (
    <GtkBox
        name="paste-box"
        spacing={12}
        controllers={(
            <GtkDropTarget
                types={[gdkTextureType, gdkPaintableType, gfileType, gdkRgbaType, GObject.TYPE_STRING]}
                actions={Gdk.DragAction.COPY}
                onDrop={onDrop}
            />
        )}
    >
        <GtkButton
            label="_Paste"
            useUnderline
            valign={Gtk.Align.CENTER}
            sensitive={canPaste}
            onClicked={() => void onPaste()}
        />
        <GtkLabel name="paste-type-label" xalign={0}>
            {pastedContent.type}
        </GtkLabel>
        <GtkStack
            name="paste-stack"
            visibleChildName={pastedContent.type || "Empty"}
            halign={Gtk.Align.END}
            valign={Gtk.Align.CENTER}
        >
            {renderPasteStackPages(pastedContent)}
        </GtkStack>
    </GtkBox>
);

function useClipboardFileDialog() {
    const [dialog, setDialog] = useState<Gtk.FileDialog | null>(null);
    const cancellable = useCancellable();

    const portal = createPortal(
        <>
            <GtkFileDialog ref={setDialog} />
            {cancellable.element}
        </>,
        rootElement,
    );

    return { dialog, cancellable: cancellable.cancellable, renew: cancellable.renew, portal };
}

function ClipboardDemo() {
    const state = useClipboardState();
    const textures = useClipboardTextures();
    const providers = useDragProviders(state);
    const parentWindow = useParentWindow();
    const fileDialog = useClipboardFileDialog();
    const folderDialog = useClipboardFileDialog();
    const clipboardHandlers = useClipboardHandlers(state, textures, {
        parentWindow,
        file: fileDialog,
        folder: folderDialog,
    });
    const formats = useProperty(getClipboard(), "formats");
    const canPaste = formats ? canPasteFrom(formats) : false;

    return (
        <>
            {fileDialog.portal}
            {folderDialog.portal}
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={12}
                marginStart={12}
                marginEnd={12}
                marginTop={12}
                marginBottom={12}
            >
                <GtkLabel wrap maxWidthChars={40}>
                    {"“Copy” will copy the selected data to the clipboard, “Paste” will show the current clipboard " +
                        "contents. You can also drag the data to the bottom."}
                </GtkLabel>

                <ClipboardSourceSection
                    state={state}
                    textures={textures}
                    providers={providers}
                    onCopy={clipboardHandlers.handleCopy}
                    onFileSelect={clipboardHandlers.handleFileSelect}
                    onFolderSelect={clipboardHandlers.handleFolderSelect}
                />

                <GtkSeparator />

                <ClipboardPasteSection
                    pastedContent={state.pastedContent}
                    canPaste={canPaste}
                    onPaste={clipboardHandlers.handlePaste}
                    onDrop={clipboardHandlers.didHandleDrop}
                />
            </GtkBox>
        </>
    );
}

export { clipboardDemo };
