import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkImage, GtkLabel, GtkScrolledWindow, GtkSwitch, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-settings.tsx?raw";

interface SettingItem {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: string;
    defaultValue: boolean;
}

const settingsData: SettingItem[] = [
    {
        id: "dark-mode",
        title: "Dark Mode",
        description: "Use dark color scheme",
        icon: "weather-clear-night-symbolic",
        category: "Appearance",
        defaultValue: false,
    },
    {
        id: "large-text",
        title: "Large Text",
        description: "Increase text size for readability",
        icon: "font-x-generic-symbolic",
        category: "Appearance",
        defaultValue: false,
    },
    {
        id: "animations",
        title: "Enable Animations",
        description: "Show smooth transitions",
        icon: "view-refresh-symbolic",
        category: "Appearance",
        defaultValue: true,
    },
    {
        id: "transparency",
        title: "Transparency Effects",
        description: "Enable window transparency",
        icon: "image-x-generic-symbolic",
        category: "Appearance",
        defaultValue: true,
    },
    {
        id: "notifications",
        title: "Notifications",
        description: "Show desktop notifications",
        icon: "preferences-system-notifications-symbolic",
        category: "Notifications",
        defaultValue: true,
    },
    {
        id: "sounds",
        title: "Notification Sounds",
        description: "Play sounds for notifications",
        icon: "audio-speakers-symbolic",
        category: "Notifications",
        defaultValue: true,
    },
    {
        id: "do-not-disturb",
        title: "Do Not Disturb",
        description: "Silence all notifications",
        icon: "notifications-disabled-symbolic",
        category: "Notifications",
        defaultValue: false,
    },
    {
        id: "badge-count",
        title: "Show Badge Count",
        description: "Display unread count on icons",
        icon: "mail-unread-symbolic",
        category: "Notifications",
        defaultValue: true,
    },
    {
        id: "location",
        title: "Location Services",
        description: "Allow apps to access location",
        icon: "find-location-symbolic",
        category: "Privacy",
        defaultValue: false,
    },
    {
        id: "camera",
        title: "Camera Access",
        description: "Allow apps to use camera",
        icon: "camera-photo-symbolic",
        category: "Privacy",
        defaultValue: false,
    },
    {
        id: "microphone",
        title: "Microphone Access",
        description: "Allow apps to use microphone",
        icon: "audio-input-microphone-symbolic",
        category: "Privacy",
        defaultValue: false,
    },
    {
        id: "analytics",
        title: "Usage Analytics",
        description: "Send anonymous usage data",
        icon: "utilities-system-monitor-symbolic",
        category: "Privacy",
        defaultValue: false,
    },
    {
        id: "auto-brightness",
        title: "Auto Brightness",
        description: "Adjust screen brightness automatically",
        icon: "display-brightness-symbolic",
        category: "Power",
        defaultValue: true,
    },
    {
        id: "power-saver",
        title: "Power Saver Mode",
        description: "Reduce performance to save battery",
        icon: "battery-symbolic",
        category: "Power",
        defaultValue: false,
    },
    {
        id: "screen-timeout",
        title: "Screen Timeout",
        description: "Turn off screen when idle",
        icon: "preferences-desktop-screensaver-symbolic",
        category: "Power",
        defaultValue: true,
    },
    {
        id: "auto-suspend",
        title: "Automatic Suspend",
        description: "Suspend system when idle",
        icon: "system-shutdown-symbolic",
        category: "Power",
        defaultValue: true,
    },
    {
        id: "wifi",
        title: "Wi-Fi",
        description: "Enable wireless networking",
        icon: "network-wireless-symbolic",
        category: "Network",
        defaultValue: true,
    },
    {
        id: "bluetooth",
        title: "Bluetooth",
        description: "Enable Bluetooth connectivity",
        icon: "bluetooth-symbolic",
        category: "Network",
        defaultValue: true,
    },
    {
        id: "airplane",
        title: "Airplane Mode",
        description: "Disable all wireless connections",
        icon: "airplane-mode-symbolic",
        category: "Network",
        defaultValue: false,
    },
    {
        id: "vpn",
        title: "VPN",
        description: "Use secure VPN connection",
        icon: "network-vpn-symbolic",
        category: "Network",
        defaultValue: false,
    },
];

const categories = ["Appearance", "Notifications", "Privacy", "Power", "Network"];

const ListViewSettingsDemo = () => {
    const [settings, setSettings] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        for (const setting of settingsData) {
            initial[setting.id] = setting.defaultValue;
        }
        return initial;
    });

    const toggleSetting = (id: string) => {
        setSettings((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    const getSettingsByCategory = (category: string): SettingItem[] => {
        return settingsData.filter((s) => s.category === category);
    };

    const getEnabledCount = (): number => {
        return Object.values(settings).filter(Boolean).length;
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
            <GtkLabel label="Settings Page" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="ListView styled as a settings page with toggle switches. Demonstrates settings rows with icons, titles, descriptions, and interactive switch controls."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkBox spacing={8}>
                <GtkLabel
                    label={`${getEnabledCount()} of ${settingsData.length} settings enabled`}
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16}>
                    {categories.map((category) => (
                        <GtkFrame key={category} label={category}>
                            <GtkBox orientation={Gtk.Orientation.VERTICAL} marginTop={8} marginBottom={8}>
                                <x.ListView<SettingItem>
                                    estimatedItemHeight={60}
                                    showSeparators
                                    renderItem={(item) => (
                                        <GtkBox
                                            spacing={12}
                                            marginTop={12}
                                            marginBottom={12}
                                            marginStart={12}
                                            marginEnd={12}
                                        >
                                            <GtkImage
                                                iconName={item?.icon ?? "preferences-system-symbolic"}
                                                pixelSize={24}
                                                cssClasses={settings[item?.id ?? ""] ? [] : ["dim-label"]}
                                            />
                                            <GtkBox
                                                orientation={Gtk.Orientation.VERTICAL}
                                                spacing={2}
                                                hexpand
                                                valign={Gtk.Align.CENTER}
                                            >
                                                <GtkLabel
                                                    label={item?.title ?? ""}
                                                    halign={Gtk.Align.START}
                                                    cssClasses={settings[item?.id ?? ""] ? [] : ["dim-label"]}
                                                />
                                                <GtkLabel
                                                    label={item?.description ?? ""}
                                                    cssClasses={["dim-label", "caption"]}
                                                    halign={Gtk.Align.START}
                                                />
                                            </GtkBox>
                                            <GtkSwitch
                                                active={settings[item?.id ?? ""] ?? false}
                                                onStateSet={() => {
                                                    if (item?.id) {
                                                        toggleSetting(item.id);
                                                    }
                                                    return true;
                                                }}
                                                valign={Gtk.Align.CENTER}
                                            />
                                        </GtkBox>
                                    )}
                                >
                                    {getSettingsByCategory(category).map((setting) => (
                                        <x.ListItem key={setting.id} id={setting.id} value={setting} />
                                    ))}
                                </x.ListView>
                            </GtkBox>
                        </GtkFrame>
                    ))}
                </GtkBox>
            </GtkScrolledWindow>

            <GtkFrame label="Active Settings">
                <GtkBox spacing={8} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
                    {Object.entries(settings)
                        .filter(([_, enabled]) => enabled)
                        .slice(0, 5)
                        .map(([id]) => {
                            const setting = settingsData.find((s) => s.id === id);
                            return (
                                <GtkBox
                                    key={id}
                                    spacing={4}
                                    cssClasses={["card"]}
                                    marginTop={2}
                                    marginBottom={2}
                                    marginStart={2}
                                    marginEnd={2}
                                >
                                    <GtkImage iconName={setting?.icon ?? ""} pixelSize={16} marginStart={8} />
                                    <GtkLabel
                                        label={setting?.title ?? id}
                                        cssClasses={["caption"]}
                                        marginEnd={8}
                                        marginTop={4}
                                        marginBottom={4}
                                    />
                                </GtkBox>
                            );
                        })}
                    {getEnabledCount() > 5 && (
                        <GtkLabel label={`+${getEnabledCount() - 5} more`} cssClasses={["dim-label", "caption"]} />
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Implementation Notes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Each setting row contains an icon, title, description, and a GtkSwitch. The switch's onStateSet callback updates React state. Settings are organized into categories with separate ListViews per category for natural grouping."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const listviewSettingsDemo: Demo = {
    id: "listview-settings",
    title: "Lists/Settings",
    description: "ListView styled as a settings page with toggle switches",
    keywords: ["listview", "settings", "GtkListView", "switch", "preferences", "toggle"],
    component: ListViewSettingsDemo,
    sourceCode,
};
