import { GridView, ListView } from "@gtkx/components";
import { css } from "@gtkx/css";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import {
    GtkBox,
    GtkButton,
    GtkDirectoryList,
    GtkHeaderBar,
    GtkImage,
    GtkLabel,
    GtkScrolledWindow,
} from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { createContext, useCallback, useContext, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./listview-filebrowser.tsx?raw";

type FileItem = {
    file: Gio.File;
    displayName: string;
    isDirectory: boolean;
    size: bigint;
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
    isLoading: boolean;
    error: GLib.Error | null;
    canNavigateUp: boolean;
    selectedIds: string[];
    setSelectedIds: (ids: string[]) => void;
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
        "This demo shows off the different layouts that are quickly achievable with GtkListView and " +
        "GtkGridView by implementing a file browser with different views.",
    keywords: ["GListModel"],
    component: ListViewFilebrowserDemo,
    titlebar: ListViewFilebrowserTitlebar,
    provider: FilebrowserProvider,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};

function collectDirectoryItems(dirList: Gtk.DirectoryList, directory: Gio.File): FileItem[] {
    const items: FileItem[] = [];
    const count = dirList.getNItems();

    for (let index = 0; index < count; index++) {
        const info = dirList.getItem(index);

        if (info instanceof Gio.FileInfo) {
            items.push({
                file: directory.getChild(info.getName()),
                displayName: info.getDisplayName(),
                isDirectory: info.getFileType() === Gio.FileType.DIRECTORY,
                size: info.getSize(),
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

type DirectoryContents = {
    directory: Gio.File | null;
    files: FileItem[];
    isLoading: boolean;
    error: GLib.Error | null;
};

function useDirectoryFiles(directory: Gio.File) {
    const [contents, setContents] = useState<DirectoryContents>({
        directory: null, files: [], isLoading: true, error: null,
    });
    const refresh = useCallback((list: Gtk.DirectoryList | null) => {
        const current = list?.getFile();

        if (!list || !current) {
            return;
        }

        const isLoading = list.isLoading();
        setContents({
            directory: current,
            files: isLoading ? [] : collectDirectoryItems(list, current).toSorted(compareFileItems),
            isLoading,
            error: list.getError(),
        });
    }, []);
    const portal = createPortal(
        <GtkDirectoryList
            key={directory.getUri()}
            ref={refresh}
            file={directory}
            attributes={ATTRIBUTES}
            onNotifyLoading={(_value, list) => {
                refresh(list);
            }}
            onNotifyError={(_value, list) => {
                refresh(list);
            }}
            onItemsChanged={(_position, _removed, _added, list) => {
                refresh(list);
            }}
        />,
        rootElement,
    );

    return {
        portal,
        ...(contents.directory?.equal(directory)
            ? contents
            : { files: [], isLoading: true, error: null }),
    };
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
        <GtkImage
            gicon={item.icon ?? undefined}
            iconSize={Gtk.IconSize.LARGE}
            accessibleLabel={item.isDirectory ? "Folder" : "File"}
        />
        <GtkLabel
            wrap
            wrapMode={Pango.WrapMode.WORD_CHAR}
            lines={2}
            ellipsize={Pango.EllipsizeMode.END}
            widthChars={10}
            maxWidthChars={30}
        >
            {item.displayName}
        </GtkLabel>
    </GtkBox>
);

const PagedFileItem = ({ item }: { item: FileItem }) => (
    <GtkBox>
        <GtkImage
            gicon={item.icon ?? undefined}
            iconSize={Gtk.IconSize.LARGE}
            accessibleLabel={item.isDirectory ? "Folder" : "File"}
        />
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel halign={Gtk.Align.START}>{item.displayName}</GtkLabel>
            <GtkLabel halign={Gtk.Align.START} cssClasses={["dim-label"]}>
                {item.isDirectory ? "folder" : GLib.formatSize(item.size)}
            </GtkLabel>
            <GtkLabel halign={Gtk.Align.START} cssClasses={["dim-label"]}>
                {item.contentType ?? ""}
            </GtkLabel>
        </GtkBox>
    </GtkBox>
);

const RowFileItem = ({ item }: { item: FileItem }) => (
    <GtkBox>
        <GtkImage gicon={item.icon ?? undefined} accessibleLabel={item.isDirectory ? "Folder" : "File"} />
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
    const [directory, setDirectory] = useState(() => Gio.File.newForPath(process.cwd()));
    const [viewMode, setViewMode] = useState<ViewMode>("list");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const { files, isLoading, error, portal } = useDirectoryFiles(directory);
    const parent = directory.getParent();

    const navigateUp = () => {
        if (!parent) {
            return;
        }

        setSelectedIds([]);
        setDirectory(parent);
    };

    const handleActivate = (position: number) => {
        const item = files[position];

        if (item?.isDirectory) {
            setSelectedIds([]);
            setDirectory(item.file);
        }
    };

    const value = {
        viewMode,
        setViewMode,
        files,
        isLoading,
        error,
        canNavigateUp: parent !== null,
        selectedIds,
        setSelectedIds,
        handleActivate,
        navigateUp,
    };

    return (
        <FilebrowserContext.Provider value={value}>
            {portal}
            {children}
        </FilebrowserContext.Provider>
    );
}

function renderViewMode({ item }: { item: ViewModeItem }) {
    return <GtkImage iconName={item.icon} tooltipText={item.label} accessibleLabel={item.label} />;
}

function ListViewFilebrowserTitlebar() {
    const { viewMode, setViewMode, navigateUp, canNavigateUp } = useFilebrowserContext();

    return (
        <GtkHeaderBar
            name="filebrowser-header"
            start={(
                <GtkButton
                    name="up-button"
                    iconName="go-up-symbolic"
                    accessibleLabel="Parent directory"
                    sensitive={canNavigateUp}
                    onClicked={navigateUp}
                />
            )}
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

const DirectoryStatus = ({ error, isLoading }: Pick<FilebrowserContextValue, "error" | "isLoading">) => (
    <GtkBox
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.CENTER}
        accessibleRole={error === null ? Gtk.AccessibleRole.STATUS : Gtk.AccessibleRole.ALERT}
    >
        <GtkLabel wrap>{error?.message ?? (isLoading ? "Loading files…" : "This directory is empty")}</GtkLabel>
    </GtkBox>
);

function ListViewFilebrowserDemo() {
    const { viewMode, files, isLoading, error, selectedIds, setSelectedIds, handleActivate } =
        useFilebrowserContext();

    if (error !== null || isLoading || files.length === 0) {
        return <DirectoryStatus error={error} isLoading={isLoading} />;
    }

    return (
        <GtkScrolledWindow name="files-scrolled" vexpand hexpand>
            <GridView
                name="files-grid"
                estimatedItemHeight={viewMode === "grid" ? 80 : 48}
                maxColumns={15}
                orientation={viewMode === "grid" ? Gtk.Orientation.VERTICAL : Gtk.Orientation.HORIZONTAL}
                selectionMode={Gtk.SelectionMode.SINGLE}
                selectedIds={selectedIds}
                onSelectionChanged={setSelectedIds}
                onActivate={handleActivate}
                renderItem={({ item }: { item: FileItem }) => <ListItem item={item} mode={viewMode} />}
                items={files.map((file) => ({ id: file.file.getUri(), value: file }))}
            />
        </GtkScrolledWindow>
    );
}

export { listviewFilebrowserDemo };
