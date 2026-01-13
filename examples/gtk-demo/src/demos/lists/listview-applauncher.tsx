import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkImage, GtkLabel, GtkScrolledWindow, GtkSearchEntry, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-applauncher.tsx?raw";

interface AppItem {
    id: string;
    name: string;
    icon: string;
    description: string;
    category: string;
}

const applications: AppItem[] = [
    {
        id: "writer",
        name: "Writer",
        icon: "x-office-document-symbolic",
        description: "Word processor",
        category: "Office",
    },
    {
        id: "calc",
        name: "Spreadsheet",
        icon: "x-office-spreadsheet-symbolic",
        description: "Spreadsheet editor",
        category: "Office",
    },
    {
        id: "impress",
        name: "Presentation",
        icon: "x-office-presentation-symbolic",
        description: "Slide presenter",
        category: "Office",
    },
    {
        id: "notes",
        name: "Notes",
        icon: "accessories-text-editor-symbolic",
        description: "Take notes",
        category: "Office",
    },
    {
        id: "gimp",
        name: "Image Editor",
        icon: "applications-graphics-symbolic",
        description: "Photo editing",
        category: "Graphics",
    },
    {
        id: "inkscape",
        name: "Vector Draw",
        icon: "applications-graphics-symbolic",
        description: "Vector graphics",
        category: "Graphics",
    },
    {
        id: "photos",
        name: "Photos",
        icon: "image-x-generic-symbolic",
        description: "View photos",
        category: "Graphics",
    },
    {
        id: "screenshot",
        name: "Screenshot",
        icon: "applets-screenshooter-symbolic",
        description: "Capture screen",
        category: "Graphics",
    },
    {
        id: "browser",
        name: "Web Browser",
        icon: "web-browser-symbolic",
        description: "Browse the web",
        category: "Internet",
    },
    { id: "email", name: "Email", icon: "mail-unread-symbolic", description: "Read email", category: "Internet" },
    {
        id: "chat",
        name: "Chat",
        icon: "user-available-symbolic",
        description: "Instant messaging",
        category: "Internet",
    },
    { id: "maps", name: "Maps", icon: "find-location-symbolic", description: "View maps", category: "Internet" },
    {
        id: "music",
        name: "Music",
        icon: "multimedia-audio-player-symbolic",
        description: "Play music",
        category: "Multimedia",
    },
    {
        id: "videos",
        name: "Videos",
        icon: "multimedia-video-player-symbolic",
        description: "Watch videos",
        category: "Multimedia",
    },
    {
        id: "podcasts",
        name: "Podcasts",
        icon: "microphone-symbolic",
        description: "Listen to podcasts",
        category: "Multimedia",
    },
    {
        id: "recorder",
        name: "Recorder",
        icon: "audio-input-microphone-symbolic",
        description: "Record audio",
        category: "Multimedia",
    },
    {
        id: "settings",
        name: "Settings",
        icon: "preferences-system-symbolic",
        description: "System settings",
        category: "System",
    },
    {
        id: "files",
        name: "Files",
        icon: "system-file-manager-symbolic",
        description: "File manager",
        category: "System",
    },
    {
        id: "terminal",
        name: "Terminal",
        icon: "utilities-terminal-symbolic",
        description: "Command line",
        category: "System",
    },
    {
        id: "monitor",
        name: "System Monitor",
        icon: "utilities-system-monitor-symbolic",
        description: "Monitor resources",
        category: "System",
    },
    {
        id: "code",
        name: "Code Editor",
        icon: "text-editor-symbolic",
        description: "Edit code",
        category: "Development",
    },
    {
        id: "builder",
        name: "Builder",
        icon: "applications-engineering-symbolic",
        description: "IDE",
        category: "Development",
    },
    {
        id: "database",
        name: "Database",
        icon: "application-x-addon-symbolic",
        description: "Database browser",
        category: "Development",
    },
    { id: "git", name: "Git", icon: "emblem-shared-symbolic", description: "Version control", category: "Development" },
];

const categories = ["All", "Office", "Graphics", "Internet", "Multimedia", "System", "Development"];

const ListViewApplauncherDemo = () => {
    const [searchText, setSearchText] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);

    const filteredApps = applications.filter((app) => {
        const matchesSearch =
            searchText === "" ||
            app.name.toLowerCase().includes(searchText.toLowerCase()) ||
            app.description.toLowerCase().includes(searchText.toLowerCase());
        const matchesCategory = selectedCategory === "All" || app.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const handleActivate = (_grid: Gtk.GridView, position: number) => {
        const app = filteredApps[position];
        if (app) {
            setSelectedApp(app);
        }
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
            <GtkLabel label="Application Launcher" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GridView as an app launcher with icons in a grid layout. Demonstrates grid-based navigation with search filtering and category selection."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Applications">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkSearchEntry
                        text={searchText}
                        placeholderText="Search applications..."
                        onSearchChanged={(entry) => setSearchText(entry.getText())}
                    />

                    <GtkScrolledWindow
                        hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                        vscrollbarPolicy={Gtk.PolicyType.NEVER}
                    >
                        <GtkBox spacing={4}>
                            {categories.map((cat) => (
                                <GtkButton
                                    key={cat}
                                    label={cat}
                                    onClicked={() => setSelectedCategory(cat)}
                                    cssClasses={selectedCategory === cat ? ["suggested-action"] : ["flat"]}
                                />
                            ))}
                        </GtkBox>
                    </GtkScrolledWindow>

                    <GtkLabel
                        label={`${filteredApps.length} applications`}
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />

                    <GtkScrolledWindow heightRequest={350} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <x.GridView<AppItem>
                            estimatedItemHeight={120}
                            minColumns={3}
                            maxColumns={6}
                            onActivate={handleActivate}
                            renderItem={(item) => (
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={8}
                                    cssClasses={["card"]}
                                    halign={Gtk.Align.CENTER}
                                    valign={Gtk.Align.CENTER}
                                    widthRequest={100}
                                    marginTop={12}
                                    marginBottom={12}
                                    marginStart={8}
                                    marginEnd={8}
                                >
                                    <GtkImage
                                        iconName={item?.icon ?? "application-x-executable-symbolic"}
                                        pixelSize={48}
                                        marginTop={8}
                                    />
                                    <GtkLabel
                                        label={item?.name ?? ""}
                                        cssClasses={["heading"]}
                                        ellipsize={3}
                                        maxWidthChars={12}
                                    />
                                    <GtkLabel
                                        label={item?.description ?? ""}
                                        cssClasses={["dim-label", "caption"]}
                                        ellipsize={3}
                                        maxWidthChars={14}
                                        marginBottom={8}
                                    />
                                </GtkBox>
                            )}
                        >
                            {filteredApps.map((app) => (
                                <x.ListItem key={app.id} id={app.id} value={app} />
                            ))}
                        </x.GridView>
                    </GtkScrolledWindow>

                    {selectedApp && (
                        <GtkBox
                            spacing={16}
                            cssClasses={["card"]}
                            marginTop={8}
                            marginBottom={8}
                            marginStart={12}
                            marginEnd={12}
                        >
                            <GtkImage iconName={selectedApp.icon} pixelSize={64} marginStart={12} />
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                hexpand
                            >
                                <GtkLabel label={selectedApp.name} halign={Gtk.Align.START} cssClasses={["title-3"]} />
                                <GtkLabel
                                    label={selectedApp.description}
                                    cssClasses={["dim-label"]}
                                    halign={Gtk.Align.START}
                                />
                                <GtkLabel
                                    label={`Category: ${selectedApp.category}`}
                                    cssClasses={["dim-label", "caption"]}
                                    halign={Gtk.Align.START}
                                />
                            </GtkBox>
                        </GtkBox>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GridView displays items in a responsive grid. minColumns and maxColumns control the grid sizing. The grid automatically reflows based on available width. Double-click or press Enter to activate an item."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const listviewApplauncherDemo: Demo = {
    id: "listview-applauncher",
    title: "Lists/Application launcher",
    description: "GridView as an application launcher with icons and categories",
    keywords: ["gridview", "launcher", "apps", "icons", "GtkGridView", "grid", "categories"],
    component: ListViewApplauncherDemo,
    sourceCode,
};
