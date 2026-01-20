import * as Gio from "@gtkx/ffi/gio";
import * as GLib from "@gtkx/ffi/glib";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkImage, GtkLabel, GtkScrolledWindow, GtkSpinner, x } from "@gtkx/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-filebrowser.tsx?raw";

interface FileItem {
    name: string;
    displayName: string;
    isDirectory: boolean;
    size: number;
    iconName: string;
    contentType: string | null;
}

const getHomeDir = () => GLib.getHomeDir() ?? "/";
const ATTRIBUTES =
    "standard::name,standard::display-name,standard::type,standard::size,standard::icon,standard::content-type";

const formatFileSize = (bytes: number): string => {
    if (bytes < 0) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const getIconName = (icon: Gio.Icon | null): string => {
    if (!icon) return "text-x-generic-symbolic";
    if (icon instanceof Gio.ThemedIcon) {
        const names = icon.getNames();
        return names[0] ?? "text-x-generic-symbolic";
    }
    return "text-x-generic-symbolic";
};

const ListViewFilebrowserDemo = () => {
    const [currentPath, setCurrentPath] = useState(getHomeDir);
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
    const [showHidden, setShowHidden] = useState(false);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setSelectedFile(null);

        const file = Gio.fileNewForPath(currentPath);
        const dirList = new Gtk.DirectoryList(ATTRIBUTES, file);

        const checkLoading = () => {
            if (dirList.isLoading()) {
                setTimeout(checkLoading, 50);
                return;
            }

            const listError = dirList.getError();
            if (listError) {
                setError(listError.getMessage() ?? "Failed to read directory");
                setLoading(false);
                return;
            }

            const items: FileItem[] = [];
            const count = dirList.getNItems();

            for (let i = 0; i < count; i++) {
                const obj = dirList.getObject(i);
                if (obj instanceof Gio.FileInfo) {
                    const name = obj.getName();
                    const displayName = obj.getDisplayName();
                    const fileType = obj.getFileType();
                    const size = obj.getSize();
                    const icon = obj.getIcon();
                    const contentType = obj.getContentType();

                    items.push({
                        name,
                        displayName,
                        isDirectory: fileType === Gio.FileType.DIRECTORY,
                        size,
                        iconName: getIconName(icon),
                        contentType,
                    });
                }
            }

            items.sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                return a.displayName.localeCompare(b.displayName);
            });

            setFiles(items);
            setLoading(false);
        };

        checkLoading();
    }, [currentPath]);

    const visibleFiles = useMemo(() => {
        if (showHidden) return files;
        return files.filter((f) => !f.name.startsWith("."));
    }, [files, showHidden]);

    const handleActivate = useCallback(
        (_list: Gtk.ListView, position: number) => {
            const item = visibleFiles[position];
            if (!item) return;

            if (item.isDirectory) {
                const newPath = currentPath === "/" ? `/${item.name}` : `${currentPath}/${item.name}`;
                setCurrentPath(newPath);
            } else {
                setSelectedFile(item);
            }
        },
        [visibleFiles, currentPath],
    );

    const navigateUp = useCallback(() => {
        if (currentPath === "/") return;
        const parent = currentPath.substring(0, currentPath.lastIndexOf("/")) || "/";
        setCurrentPath(parent);
    }, [currentPath]);

    const navigateToHome = useCallback(() => {
        setCurrentPath(getHomeDir());
    }, []);

    const navigateToRoot = useCallback(() => {
        setCurrentPath("/");
    }, []);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="File Browser" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Real filesystem browser using GtkDirectoryList. Demonstrates native file enumeration with GIO, displaying actual files from your system."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="File Manager">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={8}>
                        <GtkButton
                            iconName="go-up-symbolic"
                            onClicked={navigateUp}
                            sensitive={currentPath !== "/"}
                            cssClasses={["flat"]}
                            tooltipText="Go up one level"
                        />
                        <GtkButton
                            iconName="go-home-symbolic"
                            onClicked={navigateToHome}
                            cssClasses={["flat"]}
                            tooltipText="Go to home"
                        />
                        <GtkButton
                            iconName="drive-harddisk-symbolic"
                            onClicked={navigateToRoot}
                            cssClasses={["flat"]}
                            tooltipText="Go to root"
                        />
                        <GtkLabel
                            label={currentPath}
                            hexpand
                            halign={Gtk.Align.START}
                            cssClasses={["monospace"]}
                            ellipsize={3}
                        />
                        <GtkButton
                            label={showHidden ? "Hide Hidden" : "Show Hidden"}
                            onClicked={() => setShowHidden(!showHidden)}
                            cssClasses={["flat"]}
                        />
                    </GtkBox>

                    {loading ? (
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            heightRequest={300}
                        >
                            <GtkSpinner spinning={true} widthRequest={32} heightRequest={32} />
                            <GtkLabel label="Loading..." cssClasses={["dim-label"]} />
                        </GtkBox>
                    ) : error ? (
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            heightRequest={300}
                        >
                            <GtkImage iconName="dialog-error-symbolic" pixelSize={64} cssClasses={["error"]} />
                            <GtkLabel label={error} cssClasses={["error"]} wrap />
                        </GtkBox>
                    ) : (
                        <>
                            <GtkLabel
                                label={`${visibleFiles.length} items${!showHidden && files.length > visibleFiles.length ? ` (${files.length - visibleFiles.length} hidden)` : ""}`}
                                cssClasses={["dim-label"]}
                                halign={Gtk.Align.START}
                            />

                            <GtkScrolledWindow heightRequest={300} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                                <x.ListView<FileItem>
                                    estimatedItemHeight={48}
                                    showSeparators
                                    onActivate={handleActivate}
                                    renderItem={(item) => (
                                        <GtkBox
                                            spacing={12}
                                            marginTop={8}
                                            marginBottom={8}
                                            marginStart={12}
                                            marginEnd={12}
                                        >
                                            <GtkImage
                                                iconName={item?.iconName ?? "text-x-generic-symbolic"}
                                                pixelSize={24}
                                            />
                                            <GtkLabel
                                                label={item?.displayName ?? ""}
                                                hexpand
                                                halign={Gtk.Align.START}
                                                cssClasses={item?.isDirectory ? ["heading"] : []}
                                            />
                                            <GtkLabel
                                                label={item?.isDirectory ? "" : formatFileSize(item?.size ?? -1)}
                                                cssClasses={["dim-label", "caption", "monospace"]}
                                                widthRequest={80}
                                                halign={Gtk.Align.END}
                                            />
                                        </GtkBox>
                                    )}
                                >
                                    {visibleFiles.map((file) => (
                                        <x.ListItem key={file.name} id={file.name} value={file} />
                                    ))}
                                </x.ListView>
                            </GtkScrolledWindow>

                            {selectedFile && (
                                <GtkBox
                                    spacing={16}
                                    cssClasses={["card"]}
                                    marginTop={8}
                                    marginBottom={8}
                                    marginStart={12}
                                    marginEnd={12}
                                >
                                    <GtkImage iconName={selectedFile.iconName} pixelSize={48} marginStart={12} />
                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={4}
                                        valign={Gtk.Align.CENTER}
                                        hexpand
                                    >
                                        <GtkLabel
                                            label={selectedFile.displayName}
                                            halign={Gtk.Align.START}
                                            cssClasses={["heading"]}
                                        />
                                        <GtkBox spacing={16}>
                                            <GtkLabel
                                                label={`Size: ${formatFileSize(selectedFile.size)}`}
                                                cssClasses={["dim-label", "caption"]}
                                            />
                                            {selectedFile.contentType && (
                                                <GtkLabel
                                                    label={`Type: ${selectedFile.contentType}`}
                                                    cssClasses={["dim-label", "caption"]}
                                                />
                                            )}
                                        </GtkBox>
                                    </GtkBox>
                                </GtkBox>
                            )}

                            {visibleFiles.length === 0 && (
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={8}
                                    halign={Gtk.Align.CENTER}
                                    valign={Gtk.Align.CENTER}
                                    heightRequest={200}
                                >
                                    <GtkImage iconName="folder-symbolic" pixelSize={64} cssClasses={["dim-label"]} />
                                    <GtkLabel label="Folder is empty" cssClasses={["dim-label"]} />
                                </GtkBox>
                            )}
                        </>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Concepts" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Uses GtkDirectoryList with GIO to enumerate real filesystem contents. FileInfo objects provide file metadata including name, size, type, and icon. The list model is asynchronously populated and automatically handles file system changes when monitored."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const listviewFilebrowserDemo: Demo = {
    id: "listview-filebrowser",
    title: "Lists/File browser",
    description: "Real filesystem browser using GtkDirectoryList",
    keywords: ["listview", "files", "browser", "GtkListView", "GtkDirectoryList", "GIO", "filesystem", "directories"],
    component: ListViewFilebrowserDemo,
    sourceCode,
};
