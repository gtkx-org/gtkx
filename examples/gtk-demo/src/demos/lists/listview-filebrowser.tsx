import { GridView, ListView } from "@gtkx/components";
import { css } from "@gtkx/css";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkHeaderBar, GtkImage, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useSignal } from "@gtkx/react";
import { createContext, useContext, useMemo, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./listview-filebrowser.tsx?raw";

type FileItem = {
    name: string;
    displayName: string;
    isDirectory: boolean;
    size: number;
    icon: Gio.Icon | null;
    contentType: string | null;
};

type ViewMode = "list" | "grid" | "paged";

type ViewModeItem = {
    id: ViewMode;
    icon: string;
    label: string;
};

type FilebrowserContextValue = {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    files: FileItem[];
    handleActivate: (position: number) => void;
    navigateUp: () => void;
};

const VIEW_MODES: ViewModeItem[] = [
    { id: "list", icon: "view-list-symbolic", label: "List" },
    { id: "grid", icon: "view-grid-symbolic", label: "Grid" },
    { id: "paged", icon: "view-paged-symbolic", label: "Paged" },
];

const ATTRIBUTES =
    "standard::name,standard::display-name,standard::type,standard::size,standard::icon,standard::content-type";

const FilebrowserContext = createContext<FilebrowserContextValue | null>(null);

const listviewFilebrowserDemo: Demo = {
    id: "listview-filebrowser",
    title: "Lists/File browser",
    description:
        "This demo shows off the different layouts that are quickly achievable with GtkListview and " +
        "GtkGridView by implementing a file browser with different views.",
    keywords: ["GListModel"],
    component: ListViewFilebrowserDemo,
    titlebar: ListViewFilebrowserTitlebar,
    provider: FilebrowserProvider,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};

function formatSize(bytes: number): string {
    if (bytes < 1000) {
        return `${String(bytes)} bytes`;
    }

    if (bytes < 1_000_000) {
        return `${(bytes / 1000).toFixed(1)} kB`;
    }

    if (bytes < 1_000_000_000) {
        return `${(bytes / 1_000_000).toFixed(1)} MB`;
    }

    return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

function collectDirectoryItems(dirList: Gtk.DirectoryList): FileItem[] {
    const items: FileItem[] = [];
    const count = dirList.getNItems();

    for (let index = 0; index < count; index++) {
        const info = dirList.getItem(index);

        if (info instanceof Gio.FileInfo) {
            items.push({
                name: info.getName(),
                displayName: info.getDisplayName(),
                isDirectory: info.getFileType() === Gio.FileType.DIRECTORY,
                size: Number(info.getSize()),
                icon: info.getIcon(),
                contentType: info.getContentType(),
            });
        }
    }

    return items;
}

function compareFileItems(a: FileItem, b: FileItem): number {
    if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
    }

    return a.displayName.localeCompare(b.displayName);
}

function sortFileItems(items: FileItem[]): FileItem[] {
    return items.toSorted((a, b) => compareFileItems(a, b));
}

function navigateInto(item: FileItem | undefined, currentPath: string, setCurrentPath: (path: string) => void) {
    if (!item?.isDirectory) {
        return;
    }

    const parent = Gio.File.newForPath(currentPath);
    const child = parent.getChild(item.name);
    const childPath = child.getPath();

    if (childPath) {
        setCurrentPath(childPath);
    }
}

function useDirectoryFiles(currentPath: string) {
    const [files, setFiles] = useState<FileItem[]>([]);
    const dirList = useMemo(() => Gtk.DirectoryList.new(ATTRIBUTES, Gio.File.newForPath(currentPath)), [currentPath]);

    const refresh = () => {
        if (dirList.isLoading()) {
            return;
        }

        setFiles(sortFileItems(collectDirectoryItems(dirList)));
    };

    useSignal(dirList, "notify::loading", refresh, { immediate: true });
    useSignal(dirList, "items-changed", refresh);

    return files;
}

function useFilebrowserContext(): FilebrowserContextValue {
    const ctx = useContext(FilebrowserContext);

    if (!ctx) {
        throw new Error("FilebrowserContext is missing");
    }

    return ctx;
}

const GridFileItem = ({ item }: { item: FileItem }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.CENTER}>
        <GtkImage gicon={item.icon ?? undefined} iconSize={Gtk.IconSize.LARGE} />
        <GtkLabel wrap wrapMode={2} lines={2} ellipsize={3} widthChars={10} maxWidthChars={30}>
            {item.displayName}
        </GtkLabel>
    </GtkBox>
);

const PagedFileItem = ({ item }: { item: FileItem }) => (
    <GtkBox>
        <GtkImage gicon={item.icon ?? undefined} iconSize={Gtk.IconSize.LARGE} />
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel halign={Gtk.Align.START}>{item.displayName}</GtkLabel>
            <GtkLabel halign={Gtk.Align.START} cssClasses={["dim-label"]}>
                {item.isDirectory ? "folder" : formatSize(item.size)}
            </GtkLabel>
            <GtkLabel halign={Gtk.Align.START} cssClasses={["dim-label"]}>
                {item.contentType ?? ""}
            </GtkLabel>
        </GtkBox>
    </GtkBox>
);

const RowFileItem = ({ item }: { item: FileItem }) => (
    <GtkBox>
        <GtkImage gicon={item.icon ?? undefined} />
        <GtkLabel halign={Gtk.Align.START}>{item.displayName}</GtkLabel>
    </GtkBox>
);

const ListItem = ({ item, mode }: { item: FileItem; mode: ViewMode }) => {
    if (mode === "grid") {
        return <GridFileItem item={item} />;
    }

    if (mode === "paged") {
        return <PagedFileItem item={item} />;
    }

    return <RowFileItem item={item} />;
};

function FilebrowserProvider({ children }: DemoProviderProps) {
    const [currentPath, setCurrentPath] = useState(() => process.cwd());
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const files = useDirectoryFiles(currentPath);

    const navigateUp = () => {
        const file = Gio.File.newForPath(currentPath);
        const parent = file.getParent();

        if (parent) {
            setCurrentPath(parent.getPath() ?? "/");
        }
    };

    const handleActivate = (position: number) => {
        navigateInto(files[position], currentPath, setCurrentPath);
    };

    const value = {
        viewMode,
        setViewMode,
        files,
        handleActivate,
        navigateUp,
    };

    return <FilebrowserContext.Provider value={value}>{children}</FilebrowserContext.Provider>;
}

function renderViewMode({ item }: { item: ViewModeItem }) {
    return <GtkImage iconName={item.icon} tooltipText={item.label} />;
}

function ListViewFilebrowserTitlebar() {
    const { viewMode, setViewMode, navigateUp } = useFilebrowserContext();

    return (
        <GtkHeaderBar
            name="filebrowser-header"
            start={<GtkButton name="up-button" iconName="go-up-symbolic" onClicked={navigateUp} />}
            end={(
                <ListView
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
                    selectedIds={[viewMode]}
                    onSelectionChanged={(ids) => {
                        const id = ids[0] as ViewMode | undefined;

                        if (id) {
                            setViewMode(id);
                        }
                    }}
                    renderItem={renderViewMode}
                    items={VIEW_MODES.map((mode) => ({ id: mode.id, value: mode }))}
                />
            )}
        />
    );
}

function ListViewFilebrowserDemo() {
    const { viewMode, files, handleActivate } = useFilebrowserContext();

    return (
        <GtkScrolledWindow name="files-scrolled" vexpand hexpand>
            <GridView
                name="files-grid"
                estimatedItemHeight={viewMode === "grid" ? 80 : 48}
                maxColumns={15}
                orientation={viewMode === "grid" ? Gtk.Orientation.VERTICAL : Gtk.Orientation.HORIZONTAL}
                onActivate={handleActivate}
                renderItem={({ item }: { item: FileItem }) => <ListItem item={item} mode={viewMode} />}
                items={files.map((file) => ({ id: file.name, value: file }))}
            />
        </GtkScrolledWindow>
    );
}

export { listviewFilebrowserDemo };
