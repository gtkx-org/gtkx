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

const Slot = "Slot" as const;

import { useCallback, useEffect, useState } from "react";
import type { Demo } from "../types.js";
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

const ListViewFilebrowserDemo = () => {
    const [currentPath, setCurrentPath] = useState(() => process.cwd() ?? homedir() ?? "/");
    const [files, setFiles] = useState<FileItem[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>("list");

    useEffect(() => {
        const file = Gio.fileNewForPath(currentPath);
        const dirList = new Gtk.DirectoryList(ATTRIBUTES, file);

        const checkLoading = () => {
            if (dirList.isLoading()) {
                setTimeout(checkLoading, 50);
                return;
            }

            const items: FileItem[] = [];
            const count = dirList.getNItems();

            for (let i = 0; i < count; i++) {
                const obj = dirList.getObject(i);
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

            setFiles(items);
        };

        checkLoading();
    }, [currentPath]);

    const navigateUp = useCallback(() => {
        const file = Gio.fileNewForPath(currentPath);
        const parent = file.getParent();
        if (parent) {
            setCurrentPath(parent.getPath() ?? "/");
        }
    }, [currentPath]);

    const handleActivate = useCallback(
        (position: number) => {
            const item = files[position];
            if (!item) return;

            if (item.isDirectory) {
                const parent = Gio.fileNewForPath(currentPath);
                const child = parent.getChild(item.name);
                const childPath = child.getPath();
                if (childPath) {
                    setCurrentPath(childPath);
                }
            }
        },
        [files, currentPath],
    );

    return (
        <>
            <Slot id="titlebar">
                <GtkHeaderBar>
                    <GtkHeaderBar.PackStart>
                        <GtkButton iconName="go-up-symbolic" onClicked={navigateUp} />
                    </GtkHeaderBar.PackStart>
                    <GtkHeaderBar.PackEnd>
                        <GtkListView
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
                            renderItem={(item: ViewModeItem) => (
                                <GtkImage iconName={item.icon} tooltipText={item.label} />
                            )}
                            items={VIEW_MODES.map((mode) => ({ id: mode.id, value: mode }))}
                        />
                    </GtkHeaderBar.PackEnd>
                </GtkHeaderBar>
            </Slot>

            <GtkScrolledWindow vexpand hexpand>
                <GtkGridView
                    estimatedItemHeight={viewMode === "grid" ? 80 : 48}
                    maxColumns={15}
                    orientation={viewMode === "grid" ? Gtk.Orientation.VERTICAL : Gtk.Orientation.HORIZONTAL}
                    onActivate={handleActivate}
                    renderItem={(item: FileItem) => <ListItem item={item} mode={viewMode} />}
                    items={files.map((file) => ({ id: file.name, value: file }))}
                />
            </GtkScrolledWindow>
        </>
    );
};

export const listviewFilebrowserDemo: Demo = {
    id: "listview-filebrowser",
    title: "Lists/File browser",
    description:
        "This demo shows off the different layouts that are quickly achievable with GtkGridView by implementing a file browser with different views.",
    keywords: ["listview", "gridview", "files", "browser", "GtkGridView", "GtkDirectoryList", "views"],
    component: ListViewFilebrowserDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};
