import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkImage, GtkLabel, GtkScrolledWindow, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-filebrowser.tsx?raw";

interface FileItem {
    id: string;
    name: string;
    type: "folder" | "file";
    size?: number;
    modified: string;
    icon: string;
    children?: FileItem[];
}

const fileSystem: FileItem[] = [
    {
        id: "home",
        name: "Home",
        type: "folder",
        modified: "Dec 20, 2024",
        icon: "user-home-symbolic",
        children: [
            {
                id: "documents",
                name: "Documents",
                type: "folder",
                modified: "Dec 19, 2024",
                icon: "folder-documents-symbolic",
                children: [
                    {
                        id: "report.pdf",
                        name: "report.pdf",
                        type: "file",
                        size: 245000,
                        modified: "Dec 15, 2024",
                        icon: "x-office-document-symbolic",
                    },
                    {
                        id: "notes.txt",
                        name: "notes.txt",
                        type: "file",
                        size: 1200,
                        modified: "Dec 18, 2024",
                        icon: "text-x-generic-symbolic",
                    },
                    {
                        id: "presentation.odp",
                        name: "presentation.odp",
                        type: "file",
                        size: 1500000,
                        modified: "Dec 10, 2024",
                        icon: "x-office-presentation-symbolic",
                    },
                ],
            },
            {
                id: "pictures",
                name: "Pictures",
                type: "folder",
                modified: "Dec 18, 2024",
                icon: "folder-pictures-symbolic",
                children: [
                    {
                        id: "vacation.jpg",
                        name: "vacation.jpg",
                        type: "file",
                        size: 3200000,
                        modified: "Aug 15, 2024",
                        icon: "image-x-generic-symbolic",
                    },
                    {
                        id: "profile.png",
                        name: "profile.png",
                        type: "file",
                        size: 450000,
                        modified: "Nov 20, 2024",
                        icon: "image-x-generic-symbolic",
                    },
                    {
                        id: "screenshot.png",
                        name: "screenshot.png",
                        type: "file",
                        size: 890000,
                        modified: "Dec 17, 2024",
                        icon: "image-x-generic-symbolic",
                    },
                ],
            },
            {
                id: "music",
                name: "Music",
                type: "folder",
                modified: "Dec 10, 2024",
                icon: "folder-music-symbolic",
                children: [
                    {
                        id: "song1.mp3",
                        name: "favorite_song.mp3",
                        type: "file",
                        size: 5600000,
                        modified: "Oct 5, 2024",
                        icon: "audio-x-generic-symbolic",
                    },
                    {
                        id: "podcast.mp3",
                        name: "podcast_ep42.mp3",
                        type: "file",
                        size: 48000000,
                        modified: "Dec 8, 2024",
                        icon: "audio-x-generic-symbolic",
                    },
                ],
            },
            {
                id: "downloads",
                name: "Downloads",
                type: "folder",
                modified: "Dec 20, 2024",
                icon: "folder-download-symbolic",
                children: [
                    {
                        id: "app.deb",
                        name: "application.deb",
                        type: "file",
                        size: 25000000,
                        modified: "Dec 19, 2024",
                        icon: "application-x-executable-symbolic",
                    },
                    {
                        id: "archive.zip",
                        name: "archive.zip",
                        type: "file",
                        size: 15000000,
                        modified: "Dec 18, 2024",
                        icon: "package-x-generic-symbolic",
                    },
                ],
            },
            {
                id: ".bashrc",
                name: ".bashrc",
                type: "file",
                size: 3500,
                modified: "Nov 1, 2024",
                icon: "text-x-script-symbolic",
            },
            {
                id: ".gitconfig",
                name: ".gitconfig",
                type: "file",
                size: 500,
                modified: "Oct 15, 2024",
                icon: "text-x-generic-symbolic",
            },
        ],
    },
    {
        id: "projects",
        name: "Projects",
        type: "folder",
        modified: "Dec 20, 2024",
        icon: "folder-symbolic",
        children: [
            {
                id: "webapp",
                name: "webapp",
                type: "folder",
                modified: "Dec 19, 2024",
                icon: "folder-symbolic",
                children: [
                    {
                        id: "index.html",
                        name: "index.html",
                        type: "file",
                        size: 4500,
                        modified: "Dec 19, 2024",
                        icon: "text-html-symbolic",
                    },
                    {
                        id: "styles.css",
                        name: "styles.css",
                        type: "file",
                        size: 8900,
                        modified: "Dec 18, 2024",
                        icon: "text-css-symbolic",
                    },
                    {
                        id: "app.js",
                        name: "app.js",
                        type: "file",
                        size: 12000,
                        modified: "Dec 19, 2024",
                        icon: "text-x-script-symbolic",
                    },
                ],
            },
            {
                id: "README.md",
                name: "README.md",
                type: "file",
                size: 2500,
                modified: "Dec 15, 2024",
                icon: "text-x-generic-symbolic",
            },
        ],
    },
];

const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const ListViewFilebrowserDemo = () => {
    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
    const [showHidden, setShowHidden] = useState(false);

    const getCurrentContents = (): FileItem[] => {
        let current = fileSystem;
        for (const segment of currentPath) {
            const folder = current.find((f) => f.id === segment);
            if (folder?.children) {
                current = folder.children;
            }
        }
        if (!showHidden) {
            current = current.filter((f) => !f.name.startsWith("."));
        }
        return [...current].sort((a, b) => {
            if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    };

    const contents = getCurrentContents();

    const handleActivate = (_list: Gtk.ListView, position: number) => {
        const item = contents[position];
        if (item?.type === "folder") {
            setCurrentPath([...currentPath, item.id]);
            setSelectedFile(null);
        } else if (item) {
            setSelectedFile(item);
        }
    };

    const navigateUp = () => {
        if (currentPath.length > 0) {
            setCurrentPath(currentPath.slice(0, -1));
            setSelectedFile(null);
        }
    };

    const navigateToRoot = () => {
        setCurrentPath([]);
        setSelectedFile(null);
    };

    const getBreadcrumb = (): string => {
        if (currentPath.length === 0) return "/";
        return `/${currentPath.join("/")}`;
    };

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
                label="ListView as a file browser with directory navigation. Demonstrates hierarchical data navigation with breadcrumbs and folder traversal."
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
                            sensitive={currentPath.length > 0}
                            cssClasses={["flat"]}
                            tooltipText="Go up one level"
                        />
                        <GtkButton
                            iconName="go-home-symbolic"
                            onClicked={navigateToRoot}
                            cssClasses={["flat"]}
                            tooltipText="Go to root"
                        />
                        <GtkLabel
                            label={getBreadcrumb()}
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

                    <GtkLabel label={`${contents.length} items`} cssClasses={["dim-label"]} halign={Gtk.Align.START} />

                    <GtkScrolledWindow heightRequest={300} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <x.ListView<FileItem>
                            estimatedItemHeight={48}
                            showSeparators
                            onActivate={handleActivate}
                            renderItem={(item) => (
                                <GtkBox spacing={12} marginTop={8} marginBottom={8} marginStart={12} marginEnd={12}>
                                    <GtkImage iconName={item?.icon ?? "text-x-generic-symbolic"} pixelSize={24} />
                                    <GtkLabel
                                        label={item?.name ?? ""}
                                        hexpand
                                        halign={Gtk.Align.START}
                                        cssClasses={item?.type === "folder" ? ["heading"] : []}
                                    />
                                    <GtkLabel
                                        label={item?.type === "folder" ? "" : formatFileSize(item?.size)}
                                        cssClasses={["dim-label", "caption", "monospace"]}
                                        widthRequest={80}
                                        halign={Gtk.Align.END}
                                    />
                                    <GtkLabel
                                        label={item?.modified ?? ""}
                                        cssClasses={["dim-label", "caption"]}
                                        widthRequest={100}
                                        halign={Gtk.Align.END}
                                    />
                                </GtkBox>
                            )}
                        >
                            {contents.map((file) => (
                                <x.ListItem key={file.id} id={file.id} value={file} />
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
                            <GtkImage iconName={selectedFile.icon} pixelSize={48} marginStart={12} />
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                hexpand
                            >
                                <GtkLabel label={selectedFile.name} halign={Gtk.Align.START} cssClasses={["heading"]} />
                                <GtkBox spacing={16}>
                                    <GtkLabel
                                        label={`Size: ${formatFileSize(selectedFile.size)}`}
                                        cssClasses={["dim-label", "caption"]}
                                    />
                                    <GtkLabel
                                        label={`Modified: ${selectedFile.modified}`}
                                        cssClasses={["dim-label", "caption"]}
                                    />
                                </GtkBox>
                            </GtkBox>
                            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} valign={Gtk.Align.CENTER}>
                                <GtkButton iconName="document-open-symbolic" cssClasses={["flat"]} tooltipText="Open" />
                            </GtkBox>
                        </GtkBox>
                    )}

                    {contents.length === 0 && (
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
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Concepts" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Uses state to track the current path as an array of folder IDs. Navigation updates the path state, and the component recalculates visible contents. Double-clicking folders navigates into them; double-clicking files selects them."
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
    title: "File Browser",
    description: "ListView as a file browser with directory navigation",
    keywords: ["listview", "files", "browser", "GtkListView", "directories", "navigation", "tree"],
    component: ListViewFilebrowserDemo,
    sourceCode,
};
