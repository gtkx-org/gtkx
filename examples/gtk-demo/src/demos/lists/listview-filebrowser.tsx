import { homedir } from "node:os";
import { css } from "@gtkx/css";
import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkGridView,
    GtkHeaderBar,
    GtkImage,
    GtkLabel,
    GtkListView,
    GtkScrolledWindow,
} from "@gtkx/react";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./listview-filebrowser.tsx?raw";

function formatSize(bytes: number): string {
    if (bytes < 1_000) return `${bytes} bytes`;
    if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} kB`;
    if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

interface FileItem {
    name: string;
    displayName: string;
    isDirectory: boolean;
    size: number;
    icon: Gio.Icon | null;
    contentType: string | null;
}

type ViewMode = "list" | "grid" | "paged";

interface ViewModeItem {
    id: ViewMode;
    icon: string;
    label: string;
}

const VIEW_MODES: ViewModeItem[] = [
    { id: "list", icon: "view-list-symbolic", label: "List" },
    { id: "grid", icon: "view-grid-symbolic", label: "Grid" },
    { id: "paged", icon: "view-paged-symbolic", label: "Paged" },
];

const ATTRIBUTES =
    "standard::name,standard::display-name,standard::type,standard::size,standard::icon,standard::content-type";

const ListItem = ({ item, mode }: { item: FileItem; mode: ViewMode }) => {
    if (mode === "grid") {
        return (
            <GtkBox orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.CENTER}>
                <GtkImage gicon={item.icon ?? undefined} iconSize={Gtk.IconSize.LARGE} />
                <GtkLabel
                    label={item.displayName}
                    wrap
                    wrapMode={2}
                    lines={2}
                    ellipsize={3}
                    widthChars={10}
                    maxWidthChars={30}
                />
            </GtkBox>
        );
    }

    if (mode === "paged") {
        return (
            <GtkBox>
                <GtkImage gicon={item.icon ?? undefined} iconSize={Gtk.IconSize.LARGE} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkLabel label={item.displayName} halign={Gtk.Align.START} />
                    <GtkLabel
                        label={item.isDirectory ? "folder" : formatSize(item.size)}
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkLabel label={item.contentType ?? ""} halign={Gtk.Align.START} cssClasses={["dim-label"]} />
                </GtkBox>
            </GtkBox>
        );
    }

    return (
        <GtkBox>
            <GtkImage gicon={item.icon ?? undefined} />
            <GtkLabel label={item.displayName} halign={Gtk.Align.START} />
        </GtkBox>
    );
};

function useDirectoryFiles(currentPath: string) {
    const [files, setFiles] = useState<FileItem[]>([]);

    useEffect(() => {
        const file = Gio.fileNewForPath(currentPath);
        const dirList = Gtk.DirectoryList.new(ATTRIBUTES, file);

        const refresh = () => {
            if (dirList.isLoading()) return;
            setFiles(sortFileItems(collectDirectoryItems(dirList)));
        };

        dirList.on("notify::loading", refresh);
        dirList.on("items-changed", refresh);
        refresh();

        return () => {
            dirList.off("notify::loading", refresh);
            dirList.off("items-changed", refresh);
        };
    }, [currentPath]);

    return files;
}

const collectDirectoryItems = (dirList: Gtk.DirectoryList): FileItem[] => {
    const items: FileItem[] = [];
    const count = dirList.getNItems();

    for (let i = 0; i < count; i++) {
        const obj = dirList.getItem(i);
        if (obj instanceof Gio.FileInfo) {
            items.push({
                name: obj.getName(),
                displayName: obj.getDisplayName(),
                isDirectory: obj.getFileType() === Gio.FileType.DIRECTORY,
                size: obj.getSize(),
                icon: obj.getIcon(),
                contentType: obj.getContentType(),
            });
        }
    }

    return items;
};

const sortFileItems = (items: FileItem[]): FileItem[] =>
    [...items].sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
    });

const navigateInto = (item: FileItem | undefined, currentPath: string, setCurrentPath: (path: string) => void) => {
    if (!item?.isDirectory) return;
    const parent = Gio.fileNewForPath(currentPath);
    const child = parent.getChild(item.name);
    const childPath = child.getPath();
    if (childPath) setCurrentPath(childPath);
};

interface FilebrowserContextValue {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    files: FileItem[];
    handleActivate: (position: number) => void;
    navigateUp: () => void;
}

const FilebrowserContext = createContext<FilebrowserContextValue | null>(null);

const useFilebrowserContext = (): FilebrowserContextValue => {
    const ctx = useContext(FilebrowserContext);
    if (!ctx) throw new Error("FilebrowserContext is missing");
    return ctx;
};

const FilebrowserProvider = ({ children }: DemoProviderProps) => {
    const [currentPath, setCurrentPath] = useState(() => process.cwd() ?? homedir() ?? "/");
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const files = useDirectoryFiles(currentPath);

    const navigateUp = useCallback(() => {
        const file = Gio.fileNewForPath(currentPath);
        const parent = file.getParent();
        if (parent) setCurrentPath(parent.getPath() ?? "/");
    }, [currentPath]);

    const handleActivate = useCallback(
        (position: number) => navigateInto(files[position], currentPath, setCurrentPath),
        [files, currentPath],
    );

    const value = useMemo<FilebrowserContextValue>(
        () => ({ viewMode, setViewMode, files, handleActivate, navigateUp }),
        [viewMode, files, handleActivate, navigateUp],
    );

    return <FilebrowserContext.Provider value={value}>{children}</FilebrowserContext.Provider>;
};

const ListViewFilebrowserTitlebar = () => {
    const { viewMode, setViewMode, navigateUp } = useFilebrowserContext();
    return (
        <GtkHeaderBar name="filebrowser-header">
            <GtkHeaderBar.PackStart>
                <GtkButton name="up-button" iconName="go-up-symbolic" onClicked={navigateUp} />
            </GtkHeaderBar.PackStart>
            <GtkHeaderBar.PackEnd>
                <GtkListView
                    name="view-switcher"
                    orientation={Gtk.Orientation.HORIZONTAL}
                    cssClasses={[
                        css`
                        border: 1px solid gray;
                        & > row { padding: 5px; }
                        & row:selected { background: gray; }
                    `,
                        "linked",
                        "viewswitcher",
                    ]}
                    valign={Gtk.Align.CENTER}
                    selected={[viewMode]}
                    onSelectionChanged={(ids) => {
                        const id = ids[0] as ViewMode | undefined;
                        if (id) setViewMode(id);
                    }}
                    renderItem={(item: ViewModeItem) => <GtkImage iconName={item.icon} tooltipText={item.label} />}
                    items={VIEW_MODES.map((mode) => ({ id: mode.id, value: mode }))}
                />
            </GtkHeaderBar.PackEnd>
        </GtkHeaderBar>
    );
};

const ListViewFilebrowserDemo = () => {
    const { viewMode, files, handleActivate } = useFilebrowserContext();
    return (
        <GtkScrolledWindow name="files-scrolled" vexpand hexpand>
            <GtkGridView
                name="files-grid"
                estimatedItemHeight={viewMode === "grid" ? 80 : 48}
                maxColumns={15}
                orientation={viewMode === "grid" ? Gtk.Orientation.VERTICAL : Gtk.Orientation.HORIZONTAL}
                onActivate={handleActivate}
                renderItem={(item: FileItem) => <ListItem item={item} mode={viewMode} />}
                items={files.map((file) => ({ id: file.name, value: file }))}
            />
        </GtkScrolledWindow>
    );
};

export const listviewFilebrowserDemo: Demo = {
    id: "listview-filebrowser",
    title: "Lists/File browser",
    description:
        "This demo shows off the different layouts that are quickly achievable with GtkListview and GtkGridView by implementing a file browser with different views.",
    keywords: ["GListModel"],
    component: ListViewFilebrowserDemo,
    titlebar: ListViewFilebrowserTitlebar,
    provider: FilebrowserProvider,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};
