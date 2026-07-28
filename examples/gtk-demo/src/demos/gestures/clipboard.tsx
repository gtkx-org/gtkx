import type { Context } from "@gtkx/gi/cairo";
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
    GtkImage,
    GtkLabel,
    GtkSeparator,
    GtkStack,
    GtkStackPage,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { useParentWindow, useProperty } from "@gtkx/react";
import { useState } from "react";
import { path as floppyBuddyPath } from "#data/demos/gestures/floppybuddy.gif";
import { path as demo4LogoPath } from "#data/demos/gestures/org.gtk.Demo4.svg";
import { path as portlandRosePath } from "#data/demos/gestures/portland-rose.jpg";
import type { Demo } from "../types.js";
import { buildRgba } from "../../build-rgba.js";
import sourceCode from "./clipboard.tsx?raw";

type SourceType = "Text" | "Color" | "Image" | "File" | "Folder";
type PastedContentType = "" | "Text" | "Color" | "Image" | "File";
type SetPastedContent = React.Dispatch<React.SetStateAction<PastedContent>>;
type ClipboardState = ReturnType<typeof useClipboardState>;

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
    selectedImage: number;
    sourceFile: Gio.File | null;
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
    createImageDragProvider: () => Gdk.ContentProvider | null;
};

type ImageToggleProps = {
    name: string;
    buttonLabel: string;
    imageLabel: string;
    index: number;
    state: ClipboardState;
    paintable: Gdk.Texture;
    createProvider?: () => Gdk.ContentProvider | null;
};

type SourcePageFileProps = {
    id: "File" | "Folder";
    label: string;
    state: ClipboardState;
    onClick: () => void;
    createFileDragProvider: () => Gdk.ContentProvider | null;
};

type ClipboardPasteSectionProps = {
    pastedContent: PastedContent;
    canPaste: boolean;
    onPaste: () => Promise<void>;
    onDrop: (value: GObject.Value) => boolean;
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
        "GdkClipboard is used for clipboard handling. This demo shows how to copy and paste text, images, " +
        "colors or files to and from the clipboard.\n\nYou can also use Drag-And-Drop to copy the data from " +
        "the source to the target.",
    keywords: ["drag-and-drop", "dnd"],
    component: ClipboardDemo,
    sourceCode,
};

const logError = (error: unknown) => {
    if (error instanceof Error) {
        console.error(error.message);
    }
};

const setClipboardValue = (clipboard: Gdk.Clipboard, value: GObject.Value): void => {
    clipboard.set(value);
};

const readTextureAsync = (clipboard: Gdk.Clipboard): Promise<Gdk.Texture | null> => clipboard.readTextureAsync(null);

const readValueAsync = (clipboard: Gdk.Clipboard, type: GObject.Type): Promise<GObject.Value> =>
    clipboard.readValueAsync(type, 0, null);

function drawColorSwatch(cr: Context, width: number, height: number, rgba: Gdk.RGBA): void {
    cr.setSourceRgba(rgba.red, rgba.green, rgba.blue, rgba.alpha);
    cr.rectangle(0, 0, width, height);
    cr.fill();
}

const didApplyColorFromValue = (value: GObject.Value, setPastedContent: SetPastedContent): boolean => {
    const rgba = value.getBoxed<Gdk.RGBA>();
    setPastedContent({ type: "Color", color: buildRgba(rgba.red, rgba.green, rgba.blue, rgba.alpha) });

    return true;
};

const canCopySource = (sourceType: SourceType, sourceText: string, sourceFile: Gio.File | null): boolean => {
    if (sourceType === "Text") {
        return sourceText.length > 0;
    }

    if (sourceType === "File" || sourceType === "Folder") {
        return sourceFile !== null;
    }

    return true;
};

function useClipboardState() {
    const [sourceType, setSourceType] = useState<SourceType>("Text");
    const [sourceText, setSourceText] = useState("Copy this!");
    const [sourceColor, setSourceColor] = useState<Gdk.RGBA>(buildRgba(128 / 255, 0, 128 / 255, 1));
    const [selectedImage, setSelectedImage] = useState(0);
    const [sourceFile, setSourceFile] = useState<Gio.File | null>(null);
    const [pastedContent, setPastedContent] = useState<PastedContent>({ type: "" });
    const canCopy = canCopySource(sourceType, sourceText, sourceFile);

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
        pastedContent,
        setPastedContent,
        canCopy,
    };
}

function useClipboardTextures() {
    const portlandRoseTexture = Gdk.Texture.newFromResource(portlandRosePath);
    const floppyBuddyTexture = Gdk.Texture.newFromResource(floppyBuddyPath);
    const demo4LogoTexture = Gdk.Texture.newFromResource(demo4LogoPath);

    return { portlandRoseTexture, floppyBuddyTexture, demo4LogoTexture };
}

const getClipboard = () => Gdk.Display.getDefault()?.getClipboard() ?? null;

const canPasteFrom = (formats: Gdk.ContentFormats): boolean =>
    formats.containGtype(GObject.TYPE_STRING) ||
    formats.containGtype(gdkRgbaType) ||
    formats.containGtype(gdkPaintableType) ||
    formats.containGtype(gfileType) ||
    formats.containMimeType("image/png");

const createImageProvider = (selectedImage: number) => {
    const path = imagePathForIndex(selectedImage);

    try {
        const texture = Gdk.Texture.newFromResource(path);

        return Gdk.ContentProvider.newForValue(GObject.buildValue(gdkPaintableType, (v) => {
            v.setObject(texture);
        }));
    } catch (error) {
        logError(error);

        return null;
    }
};

function useDragProviders(state: ClipboardState) {
    const { sourceText, sourceColor, selectedImage, sourceFile } = state;

    const createTextDragProvider = () =>
        Gdk.ContentProvider.newForValue(GObject.buildValue(GObject.TYPE_STRING, (v) => {
            v.setString(sourceText);
        }));

    const createColorDragProvider = () =>
        Gdk.ContentProvider.newForValue(GObject.buildValue(gdkRgbaType, (v) => {
            v.setBoxed(sourceColor);
        }));

    const createImageDragProvider = () => createImageProvider(selectedImage);

    const createFileDragProvider = () => {
        if (!sourceFile) {
            return null;
        }

        return Gdk.ContentProvider.newForValue(GObject.buildValue(gfileType, (v) => {
            v.setObject(sourceFile);
        }));
    };

    return { createTextDragProvider, createColorDragProvider, createImageDragProvider, createFileDragProvider };
}

const imagePathForIndex = (index: number) => {
    const paths = [portlandRosePath, floppyBuddyPath, demo4LogoPath];

    return paths[index] ?? portlandRosePath;
};

const copyTextToClipboard = (clipboard: Gdk.Clipboard, sourceText: string) => {
    setClipboardValue(
        clipboard,
        GObject.buildValue(GObject.TYPE_STRING, (v) => {
            v.setString(sourceText);
        }),
    );
};

const copyColorToClipboard = (clipboard: Gdk.Clipboard, sourceColor: Gdk.RGBA) => {
    setClipboardValue(
        clipboard,
        GObject.buildValue(gdkRgbaType, (v) => {
            v.setBoxed(sourceColor);
        }),
    );
};

const copyImageToClipboard = (clipboard: Gdk.Clipboard, selectedImage: number) => {
    const path = imagePathForIndex(selectedImage);

    try {
        const texture = Gdk.Texture.newFromResource(path);

        setClipboardValue(
            clipboard,
            GObject.buildValue(gdkPaintableType, (v) => {
                v.setObject(texture);
            }),
        );
    } catch (error) {
        logError(error);
    }
};

const copyFileToClipboard = (clipboard: Gdk.Clipboard, sourceFile: Gio.File) => {
    setClipboardValue(
        clipboard,
        GObject.buildValue(gfileType, (v) => {
            v.setObject(sourceFile);
        }),
    );
};

const copySourceToClipboard = ({
    sourceType,
    sourceText,
    sourceColor,
    selectedImage,
    sourceFile,
}: CopySourceArgs) => {
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
            copyImageToClipboard(clipboard, selectedImage);
            break;
        }
        case "File":
        case "Folder": {
            if (sourceFile) {
                copyFileToClipboard(clipboard, sourceFile);
            }

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

function useClipboardHandlers(state: ClipboardState, parentWindow: Gtk.Window | null) {
    const { setSourceFile, setPastedContent } = state;

    const handleCopy = () => {
        copySourceToClipboard(state);
    };

    const handlePaste = () => pasteFromClipboard(setPastedContent);

    const handleFileSelect = () => {
        void openFileDialog(parentWindow, "file", setSourceFile);
    };

    const handleFolderSelect = () => {
        void openFileDialog(parentWindow, "folder", setSourceFile);
    };

    const didHandleDrop = (value: GObject.Value) => didHandleClipboardDrop(value, setPastedContent);

    return { handleCopy, handlePaste, handleFileSelect, handleFolderSelect, didHandleDrop };
}

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

async function tryPastePaintable(
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> {
    if (!formats.containGtype(gdkPaintableType)) {
        return false;
    }

    const value = await readValueAsync(clipboard, gdkPaintableType);
    const obj = value.getObject();

    if (!obj) {
        return false;
    }

    setPastedContent({ type: "Image", paintable: obj as Gdk.Paintable });

    return true;
}

async function tryPasteColor(
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> {
    if (!formats.containGtype(gdkRgbaType)) {
        return false;
    }

    const value = await readValueAsync(clipboard, gdkRgbaType);

    return didApplyColorFromValue(value, setPastedContent);
}

async function tryPasteFile(
    clipboard: Gdk.Clipboard,
    formats: Gdk.ContentFormats,
    setPastedContent: SetPastedContent,
): Promise<boolean> {
    if (!formats.containGtype(gfileType)) {
        return false;
    }

    const value = await readValueAsync(clipboard, gfileType);
    const obj = value.getObject();

    if (!(obj instanceof Gio.File)) {
        return false;
    }

    setPastedContent({ type: "File", filePath: obj.getPath() ?? obj.getUri() });

    return true;
}

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

const openFileDialog = async (
    window: Gtk.Window | null,
    kind: "file" | "folder",
    setSourceFile: (f: Gio.File) => void,
) => {
    const dialog = new Gtk.FileDialog();

    try {
        const file = kind === "file" ? await dialog.open(window, null) : await dialog.selectFolder(window, null);
        setSourceFile(file);
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

    return didApplyColorFromValue(value, setPastedContent);
};

const didHandleTextDrop = (value: GObject.Value, setPastedContent: SetPastedContent): boolean => {
    if (!GObject.typeCheckValueHolds(value, GObject.TYPE_STRING)) {
        return false;
    }

    const text = value.getString();

    if (!text) {
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
            <SourcePageImage
                state={state}
                textures={textures}
                createImageDragProvider={providers.createImageDragProvider}
            />
            <SourcePageFile
                id="File"
                label="File Drag Source"
                state={state}
                onClick={onFileSelect}
                createFileDragProvider={providers.createFileDragProvider}
            />
            <SourcePageFile
                id="Folder"
                label="Folder Drag Source"
                state={state}
                onClick={onFolderSelect}
                createFileDragProvider={providers.createFileDragProvider}
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

const SourcePageImage = ({ state, textures, createImageDragProvider }: SourcePageImageProps) => (
    <GtkStackPage name="Image">
        <GtkBox valign={Gtk.Align.CENTER} cssClasses={["linked"]}>
            <ImageToggle
                name="image_rose"
                buttonLabel="Photo Drag Source"
                imageLabel="Portland Rose Photo"
                index={0}
                state={state}
                paintable={textures.portlandRoseTexture}
            />
            <ImageToggle
                name="image_floppy"
                buttonLabel="Icon Drag Source"
                imageLabel="Floppy Buddy Icon"
                index={1}
                state={state}
                paintable={textures.floppyBuddyTexture}
                createProvider={createImageDragProvider}
            />
            <ImageToggle
                name="image_logo"
                buttonLabel="SVG Drag Source"
                imageLabel="gtk-demo logo"
                index={2}
                state={state}
                paintable={textures.demo4LogoTexture}
                createProvider={createImageDragProvider}
            />
        </GtkBox>
    </GtkStackPage>
);

const ImageToggle = ({ name, buttonLabel, imageLabel, index, state, paintable, createProvider }: ImageToggleProps) => (
    <GtkToggleButton
        name={name}
        accessibleLabel={buttonLabel}
        active={state.selectedImage === index}
        onToggled={(btn) => {
            if (btn.getActive()) {
                state.setSelectedImage(index);
            }
        }}
        controllers={createProvider ? <GtkDragSource onPrepare={createProvider} actions={Gdk.DragAction.COPY} /> : null}
    >
        <GtkImage accessibleLabel={imageLabel} paintable={paintable} cssClasses={["large-icons"]} />
    </GtkToggleButton>
);

const SourcePageFile = ({ id, label, state, onClick, createFileDragProvider }: SourcePageFileProps) => (
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
                {state.sourceFile ? (state.sourceFile.getPath() ?? "—") : "—"}
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

function ClipboardDemo() {
    const state = useClipboardState();
    const textures = useClipboardTextures();
    const providers = useDragProviders(state);
    const parentWindow = useParentWindow();
    const clipboardHandlers = useClipboardHandlers(state, parentWindow);
    const formats = useProperty(getClipboard(), "formats");
    const canPaste = formats ? canPasteFrom(formats) : false;

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={12}
            marginStart={12}
            marginEnd={12}
            marginTop={12}
            marginBottom={12}
        >
            <GtkLabel wrap maxWidthChars={40}>
                {"“Copy” will copy the selected data the clipboard, “Paste” will show the current clipboard " +
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
    );
}

export { clipboardDemo };
