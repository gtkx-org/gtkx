import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkImage, GtkLabel, GtkScrolledWindow, GtkSwitch, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-settings2.tsx?raw";

interface Category {
    type: "category";
    id: string;
    name: string;
    icon: string;
}

interface Setting {
    type: "setting";
    id: string;
    title: string;
    description: string;
    icon: string;
    defaultValue: boolean;
}

type TreeItem = Category | Setting;

interface CategoryWithChildren extends Category {
    children: Setting[];
}

const categoriesData: CategoryWithChildren[] = [
    {
        type: "category",
        id: "appearance",
        name: "Appearance",
        icon: "preferences-desktop-appearance-symbolic",
        children: [
            {
                type: "setting",
                id: "dark-mode",
                title: "Dark Mode",
                description: "Use dark color scheme",
                icon: "weather-clear-night-symbolic",
                defaultValue: false,
            },
            {
                type: "setting",
                id: "large-text",
                title: "Large Text",
                description: "Increase text size for readability",
                icon: "font-x-generic-symbolic",
                defaultValue: false,
            },
            {
                type: "setting",
                id: "animations",
                title: "Enable Animations",
                description: "Show smooth transitions",
                icon: "view-refresh-symbolic",
                defaultValue: true,
            },
            {
                type: "setting",
                id: "transparency",
                title: "Transparency Effects",
                description: "Enable window transparency",
                icon: "image-x-generic-symbolic",
                defaultValue: true,
            },
        ],
    },
    {
        type: "category",
        id: "notifications",
        name: "Notifications",
        icon: "preferences-system-notifications-symbolic",
        children: [
            {
                type: "setting",
                id: "notifications-enabled",
                title: "Notifications",
                description: "Show desktop notifications",
                icon: "preferences-system-notifications-symbolic",
                defaultValue: true,
            },
            {
                type: "setting",
                id: "sounds",
                title: "Notification Sounds",
                description: "Play sounds for notifications",
                icon: "audio-speakers-symbolic",
                defaultValue: true,
            },
            {
                type: "setting",
                id: "do-not-disturb",
                title: "Do Not Disturb",
                description: "Silence all notifications",
                icon: "notifications-disabled-symbolic",
                defaultValue: false,
            },
            {
                type: "setting",
                id: "badge-count",
                title: "Show Badge Count",
                description: "Display unread count on icons",
                icon: "mail-unread-symbolic",
                defaultValue: true,
            },
        ],
    },
    {
        type: "category",
        id: "privacy",
        name: "Privacy",
        icon: "preferences-system-privacy-symbolic",
        children: [
            {
                type: "setting",
                id: "location",
                title: "Location Services",
                description: "Allow apps to access location",
                icon: "find-location-symbolic",
                defaultValue: false,
            },
            {
                type: "setting",
                id: "camera",
                title: "Camera Access",
                description: "Allow apps to use camera",
                icon: "camera-photo-symbolic",
                defaultValue: false,
            },
            {
                type: "setting",
                id: "microphone",
                title: "Microphone Access",
                description: "Allow apps to use microphone",
                icon: "audio-input-microphone-symbolic",
                defaultValue: false,
            },
            {
                type: "setting",
                id: "analytics",
                title: "Usage Analytics",
                description: "Send anonymous usage data",
                icon: "utilities-system-monitor-symbolic",
                defaultValue: false,
            },
        ],
    },
    {
        type: "category",
        id: "power",
        name: "Power",
        icon: "preferences-system-power-symbolic",
        children: [
            {
                type: "setting",
                id: "auto-brightness",
                title: "Auto Brightness",
                description: "Adjust screen brightness automatically",
                icon: "display-brightness-symbolic",
                defaultValue: true,
            },
            {
                type: "setting",
                id: "power-saver",
                title: "Power Saver Mode",
                description: "Reduce performance to save battery",
                icon: "battery-symbolic",
                defaultValue: false,
            },
            {
                type: "setting",
                id: "screen-timeout",
                title: "Screen Timeout",
                description: "Turn off screen when idle",
                icon: "preferences-desktop-screensaver-symbolic",
                defaultValue: true,
            },
            {
                type: "setting",
                id: "auto-suspend",
                title: "Automatic Suspend",
                description: "Suspend system when idle",
                icon: "system-shutdown-symbolic",
                defaultValue: true,
            },
        ],
    },
    {
        type: "category",
        id: "network",
        name: "Network",
        icon: "preferences-system-network-symbolic",
        children: [
            {
                type: "setting",
                id: "wifi",
                title: "Wi-Fi",
                description: "Enable wireless networking",
                icon: "network-wireless-symbolic",
                defaultValue: true,
            },
            {
                type: "setting",
                id: "bluetooth",
                title: "Bluetooth",
                description: "Enable Bluetooth connectivity",
                icon: "bluetooth-symbolic",
                defaultValue: true,
            },
            {
                type: "setting",
                id: "airplane",
                title: "Airplane Mode",
                description: "Disable all wireless connections",
                icon: "airplane-mode-symbolic",
                defaultValue: false,
            },
            {
                type: "setting",
                id: "vpn",
                title: "VPN",
                description: "Use secure VPN connection",
                icon: "network-vpn-symbolic",
                defaultValue: false,
            },
        ],
    },
];

const ListViewSettings2Demo = () => {
    const [settings, setSettings] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        for (const category of categoriesData) {
            for (const setting of category.children) {
                initial[setting.id] = setting.defaultValue;
            }
        }
        return initial;
    });

    const toggleSetting = (id: string) => {
        setSettings((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    const getEnabledCount = (): number => {
        return Object.values(settings).filter(Boolean).length;
    };

    const getTotalSettings = (): number => {
        return categoriesData.reduce((sum, cat) => sum + cat.children.length, 0);
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
            <GtkLabel label="Settings Tree" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="TreeListView with expandable categories using GtkTreeExpander. Categories can be expanded/collapsed to show their settings. This demo uses TreeListModel for native tree support."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkBox spacing={8}>
                <GtkLabel
                    label={`${getEnabledCount()} of ${getTotalSettings()} settings enabled`}
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                <x.TreeListView<TreeItem>
                    estimatedItemHeight={48}
                    renderItem={(item, _row) => {
                        if (!item) {
                            return <GtkLabel label="Loading..." />;
                        }

                        if (item.type === "category") {
                            return (
                                <GtkBox spacing={12} marginTop={8} marginBottom={8} marginEnd={12}>
                                    <GtkImage iconName={item.icon} pixelSize={20} />
                                    <GtkLabel
                                        label={item.name}
                                        cssClasses={["heading"]}
                                        hexpand
                                        halign={Gtk.Align.START}
                                    />
                                    <GtkLabel
                                        label={`${categoriesData.find((c) => c.id === item.id)?.children.length ?? 0} items`}
                                        cssClasses={["dim-label", "caption"]}
                                    />
                                </GtkBox>
                            );
                        }

                        const setting = item as Setting;
                        const isEnabled = settings[setting.id] ?? false;

                        return (
                            <GtkBox spacing={12} marginTop={8} marginBottom={8} marginEnd={12}>
                                <GtkImage
                                    iconName={setting.icon}
                                    pixelSize={20}
                                    cssClasses={isEnabled ? [] : ["dim-label"]}
                                />
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={2}
                                    hexpand
                                    valign={Gtk.Align.CENTER}
                                >
                                    <GtkLabel
                                        label={setting.title}
                                        halign={Gtk.Align.START}
                                        cssClasses={isEnabled ? [] : ["dim-label"]}
                                    />
                                    <GtkLabel
                                        label={setting.description}
                                        cssClasses={["dim-label", "caption"]}
                                        halign={Gtk.Align.START}
                                    />
                                </GtkBox>
                                <GtkSwitch
                                    active={isEnabled}
                                    onStateSet={() => {
                                        toggleSetting(setting.id);
                                        return true;
                                    }}
                                    valign={Gtk.Align.CENTER}
                                />
                            </GtkBox>
                        );
                    }}
                >
                    {categoriesData.map((category) => (
                        <x.TreeListItem key={category.id} id={category.id} value={category as TreeItem}>
                            {category.children.map((setting) => (
                                <x.TreeListItem
                                    key={setting.id}
                                    id={setting.id}
                                    value={setting as TreeItem}
                                    hideExpander
                                />
                            ))}
                        </x.TreeListItem>
                    ))}
                </x.TreeListView>
            </GtkScrolledWindow>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Implementation Notes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="This demo uses TreeListView with TreeListModel for native hierarchical data support. Categories are expandable rows that contain nested settings. The tree structure is defined declaratively by nesting TreeListItem components. GtkTreeExpander handles the expand/collapse UI and indentation automatically."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const listviewSettings2Demo: Demo = {
    id: "listview-settings2",
    title: "Settings Tree",
    description: "TreeListView with expandable categories using GtkTreeExpander",
    keywords: ["treelistview", "treelistmodel", "settings", "tree", "expander", "hierarchical"],
    component: ListViewSettings2Demo,
    sourceCode,
};
