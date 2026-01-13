import type * as Gtk from "@gtkx/ffi/gtk";
import * as GtkEnum from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkFrame,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkPaned,
    GtkRevealer,
    GtkScrolledWindow,
    GtkStack,
    GtkStackSidebar,
    x,
} from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./sidebar.tsx?raw";

interface NavItem {
    id: string;
    title: string;
    icon: string;
    description: string;
}

const SidebarDemo = () => {
    const [selectedItem, setSelectedItem] = useState("inbox");
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [stack, setStack] = useState<Gtk.Stack | null>(null);

    const navItems: NavItem[] = [
        { id: "inbox", title: "Inbox", icon: "mail-inbox-symbolic", description: "Your incoming messages" },
        { id: "starred", title: "Starred", icon: "starred-symbolic", description: "Important messages you've starred" },
        { id: "sent", title: "Sent", icon: "mail-send-symbolic", description: "Messages you've sent" },
        { id: "drafts", title: "Drafts", icon: "document-edit-symbolic", description: "Unfinished messages" },
        { id: "archive", title: "Archive", icon: "folder-symbolic", description: "Archived messages" },
        { id: "trash", title: "Trash", icon: "user-trash-symbolic", description: "Deleted messages" },
    ];

    const currentItem = navItems.find((item) => item.id === selectedItem);

    return (
        <GtkBox
            orientation={GtkEnum.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Sidebar Navigation" cssClasses={["title-2"]} halign={GtkEnum.Align.START} />

            <GtkBox orientation={GtkEnum.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="About Navigation Sidebars" cssClasses={["heading"]} halign={GtkEnum.Align.START} />
                <GtkLabel
                    label="Sidebars provide navigation in applications with multiple sections. Common patterns include GtkStackSidebar for Stack-based navigation, custom ListBox sidebars, and collapsible panels with GtkRevealer."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={GtkEnum.Align.START}
                />
            </GtkBox>

            <GtkFrame>
                <GtkBox
                    orientation={GtkEnum.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel label="GtkStackSidebar" cssClasses={["heading"]} halign={GtkEnum.Align.START} />
                    <GtkLabel
                        label="GtkStackSidebar automatically displays navigation items for all pages in a GtkStack."
                        wrap
                        cssClasses={["dim-label"]}
                        halign={GtkEnum.Align.START}
                    />
                    <GtkBox heightRequest={260}>
                        <GtkFrame cssClasses={["card"]} widthRequest={150}>
                            <GtkStackSidebar stack={stack ?? undefined} />
                        </GtkFrame>
                        <GtkFrame cssClasses={["card"]} hexpand>
                            <GtkStack
                                ref={setStack}
                                transitionType={GtkEnum.StackTransitionType.CROSSFADE}
                                transitionDuration={200}
                            >
                                <x.StackPage id="home" title="Home" iconName="go-home-symbolic">
                                    <GtkBox
                                        orientation={GtkEnum.Orientation.VERTICAL}
                                        spacing={8}
                                        valign={GtkEnum.Align.CENTER}
                                        halign={GtkEnum.Align.CENTER}
                                    >
                                        <GtkImage
                                            iconName="go-home-symbolic"
                                            pixelSize={48}
                                            cssClasses={["dim-label"]}
                                        />
                                        <GtkLabel label="Home" cssClasses={["title-2"]} />
                                        <GtkLabel label="Welcome to the application" cssClasses={["dim-label"]} />
                                    </GtkBox>
                                </x.StackPage>
                                <x.StackPage id="library" title="Library" iconName="folder-music-symbolic">
                                    <GtkBox
                                        orientation={GtkEnum.Orientation.VERTICAL}
                                        spacing={8}
                                        valign={GtkEnum.Align.CENTER}
                                        halign={GtkEnum.Align.CENTER}
                                    >
                                        <GtkImage
                                            iconName="folder-music-symbolic"
                                            pixelSize={48}
                                            cssClasses={["dim-label"]}
                                        />
                                        <GtkLabel label="Library" cssClasses={["title-2"]} />
                                        <GtkLabel label="Browse your media library" cssClasses={["dim-label"]} />
                                    </GtkBox>
                                </x.StackPage>
                                <x.StackPage id="search" title="Search" iconName="system-search-symbolic">
                                    <GtkBox
                                        orientation={GtkEnum.Orientation.VERTICAL}
                                        spacing={8}
                                        valign={GtkEnum.Align.CENTER}
                                        halign={GtkEnum.Align.CENTER}
                                    >
                                        <GtkImage
                                            iconName="system-search-symbolic"
                                            pixelSize={48}
                                            cssClasses={["dim-label"]}
                                        />
                                        <GtkLabel label="Search" cssClasses={["title-2"]} />
                                        <GtkLabel label="Find content" cssClasses={["dim-label"]} />
                                    </GtkBox>
                                </x.StackPage>
                                <x.StackPage id="settings" title="Settings" iconName="emblem-system-symbolic">
                                    <GtkBox
                                        orientation={GtkEnum.Orientation.VERTICAL}
                                        spacing={8}
                                        valign={GtkEnum.Align.CENTER}
                                        halign={GtkEnum.Align.CENTER}
                                    >
                                        <GtkImage
                                            iconName="emblem-system-symbolic"
                                            pixelSize={48}
                                            cssClasses={["dim-label"]}
                                        />
                                        <GtkLabel label="Settings" cssClasses={["title-2"]} />
                                        <GtkLabel label="Configure the application" cssClasses={["dim-label"]} />
                                    </GtkBox>
                                </x.StackPage>
                            </GtkStack>
                        </GtkFrame>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame>
                <GtkBox
                    orientation={GtkEnum.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel label="Custom ListBox Sidebar" cssClasses={["heading"]} halign={GtkEnum.Align.START} />
                    <GtkLabel
                        label="Build a custom sidebar using GtkListBox for full control over appearance and behavior."
                        wrap
                        cssClasses={["dim-label"]}
                        halign={GtkEnum.Align.START}
                    />
                    <GtkBox heightRequest={320}>
                        <GtkFrame cssClasses={["card"]} widthRequest={180}>
                            <GtkScrolledWindow hscrollbarPolicy={GtkEnum.PolicyType.NEVER}>
                                <GtkListBox
                                    selectionMode={GtkEnum.SelectionMode.SINGLE}
                                    cssClasses={["navigation-sidebar"]}
                                >
                                    {navItems.map((item) => (
                                        <GtkListBoxRow key={item.id} onActivate={() => setSelectedItem(item.id)}>
                                            <GtkBox
                                                spacing={12}
                                                marginStart={8}
                                                marginEnd={8}
                                                marginTop={8}
                                                marginBottom={8}
                                            >
                                                <GtkImage iconName={item.icon} pixelSize={16} />
                                                <GtkLabel label={item.title} hexpand halign={GtkEnum.Align.START} />
                                                {item.id === "inbox" && (
                                                    <GtkLabel label="12" cssClasses={["dim-label"]} />
                                                )}
                                            </GtkBox>
                                        </GtkListBoxRow>
                                    ))}
                                </GtkListBox>
                            </GtkScrolledWindow>
                        </GtkFrame>
                        <GtkFrame cssClasses={["card"]} hexpand>
                            <GtkBox
                                orientation={GtkEnum.Orientation.VERTICAL}
                                spacing={12}
                                marginStart={16}
                                marginEnd={16}
                                marginTop={16}
                                marginBottom={16}
                            >
                                <GtkBox spacing={12}>
                                    <GtkImage iconName={currentItem?.icon ?? "folder-symbolic"} pixelSize={32} />
                                    <GtkLabel label={currentItem?.title ?? ""} cssClasses={["title-2"]} />
                                </GtkBox>
                                <GtkLabel
                                    label={currentItem?.description ?? ""}
                                    wrap
                                    cssClasses={["dim-label"]}
                                    halign={GtkEnum.Align.START}
                                />
                                <GtkLabel
                                    label={`Selected: ${selectedItem}`}
                                    cssClasses={["dim-label"]}
                                    halign={GtkEnum.Align.START}
                                />
                            </GtkBox>
                        </GtkFrame>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame>
                <GtkBox
                    orientation={GtkEnum.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel label="Collapsible Sidebar" cssClasses={["heading"]} halign={GtkEnum.Align.START} />
                    <GtkLabel
                        label="Combine GtkRevealer with a sidebar for a collapsible navigation panel."
                        wrap
                        cssClasses={["dim-label"]}
                        halign={GtkEnum.Align.START}
                    />
                    <GtkButton
                        label={sidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
                        onClicked={() => setSidebarVisible(!sidebarVisible)}
                        halign={GtkEnum.Align.START}
                    />
                    <GtkBox heightRequest={240}>
                        <GtkRevealer
                            revealChild={sidebarVisible}
                            transitionType={GtkEnum.RevealerTransitionType.SLIDE_RIGHT}
                            transitionDuration={200}
                        >
                            <GtkFrame cssClasses={["card"]} widthRequest={160}>
                                <GtkBox
                                    orientation={GtkEnum.Orientation.VERTICAL}
                                    spacing={4}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={8}
                                    marginBottom={8}
                                >
                                    <GtkLabel
                                        label="Navigation"
                                        cssClasses={["heading"]}
                                        halign={GtkEnum.Align.START}
                                        marginBottom={8}
                                    />
                                    <GtkButton label="Dashboard" cssClasses={["flat"]} />
                                    <GtkButton label="Projects" cssClasses={["flat"]} />
                                    <GtkButton label="Team" cssClasses={["flat"]} />
                                    <GtkButton label="Reports" cssClasses={["flat"]} />
                                </GtkBox>
                            </GtkFrame>
                        </GtkRevealer>
                        <GtkFrame cssClasses={["card"]} hexpand>
                            <GtkBox
                                orientation={GtkEnum.Orientation.VERTICAL}
                                spacing={4}
                                valign={GtkEnum.Align.CENTER}
                                halign={GtkEnum.Align.CENTER}
                            >
                                <GtkLabel label="Content Area" cssClasses={["title-3"]} />
                                <GtkLabel label="The sidebar slides in and out smoothly" cssClasses={["dim-label"]} />
                            </GtkBox>
                        </GtkFrame>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame>
                <GtkBox
                    orientation={GtkEnum.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel label="Resizable Sidebar" cssClasses={["heading"]} halign={GtkEnum.Align.START} />
                    <GtkLabel
                        label="Use GtkPaned for a user-resizable sidebar."
                        wrap
                        cssClasses={["dim-label"]}
                        halign={GtkEnum.Align.START}
                    />
                    <GtkPaned position={160} wideHandle heightRequest={200} cssClasses={["card"]}>
                        <x.Slot for={GtkPaned} id="startChild">
                            <GtkScrolledWindow hscrollbarPolicy={GtkEnum.PolicyType.NEVER}>
                                <GtkBox
                                    orientation={GtkEnum.Orientation.VERTICAL}
                                    spacing={4}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={8}
                                    marginBottom={8}
                                >
                                    <GtkButton label="Overview" cssClasses={["flat"]} />
                                    <GtkButton label="Analytics" cssClasses={["flat"]} />
                                    <GtkButton label="Users" cssClasses={["flat"]} />
                                    <GtkButton label="Logs" cssClasses={["flat"]} />
                                </GtkBox>
                            </GtkScrolledWindow>
                        </x.Slot>
                        <x.Slot for={GtkPaned} id="endChild">
                            <GtkBox
                                orientation={GtkEnum.Orientation.VERTICAL}
                                valign={GtkEnum.Align.CENTER}
                                halign={GtkEnum.Align.CENTER}
                            >
                                <GtkLabel label="Drag the handle to resize" cssClasses={["dim-label"]} />
                            </GtkBox>
                        </x.Slot>
                    </GtkPaned>
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={GtkEnum.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Patterns" cssClasses={["heading"]} halign={GtkEnum.Align.START} />
                <GtkLabel
                    label="GtkStackSidebar: Automatic navigation for GtkStack pages. GtkListBox: Custom sidebar with full control. GtkRevealer: Collapsible sidebar with animation. GtkPaned: User-resizable sidebar."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={GtkEnum.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const sidebarDemo: Demo = {
    id: "sidebar",
    title: "Sidebar",
    description: "Navigation sidebar patterns with GtkStackSidebar and ListBox.",
    keywords: ["sidebar", "navigation", "menu", "GtkStackSidebar", "ListBox", "panel", "drawer"],
    component: SidebarDemo,
    sourceCode,
};
