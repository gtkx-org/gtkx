import * as Gdk from "@gtkx/ffi/gdk";
import * as Gio from "@gtkx/ffi/gio";
import "@gtkx/ffi/giounix";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkImage, GtkLabel, GtkScrolledWindow, x } from "@gtkx/react";
import { useCallback, useEffect, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-applauncher.tsx?raw";

interface AppItem {
    appInfo: Gio.AppInfo;
    id: string;
    name: string;
    iconName: string;
}

const getIconName = (icon: Gio.Icon | null): string => {
    if (!icon) return "application-x-executable-symbolic";
    if (icon instanceof Gio.ThemedIcon) {
        const names = icon.getNames();
        return names[0] ?? "application-x-executable-symbolic";
    }
    return "application-x-executable-symbolic";
};

const ListViewApplauncherDemo = () => {
    const [apps, setApps] = useState<AppItem[]>([]);

    useEffect(() => {
        const allApps = Gio.appInfoGetAll();
        const appItems: AppItem[] = allApps.map((app) => ({
            appInfo: app,
            id: app.getId() ?? crypto.randomUUID(),
            name: app.getDisplayName(),
            iconName: getIconName(app.getIcon()),
        }));
        setApps(appItems);
    }, []);

    const handleActivate = useCallback(
        (_listView: Gtk.ListView, position: number) => {
            const app = apps[position];
            if (!app) return;

            const display = Gdk.Display.getDefault();
            if (!display) return;

            const context = display.getAppLaunchContext();
            try {
                app.appInfo.launch(null, context);
            } catch (error) {
                console.error("Could not launch", app.name, error);
            }
        },
        [apps],
    );

    return (
        <GtkScrolledWindow vexpand hexpand>
            <x.ListView<AppItem>
                estimatedItemHeight={48}
                onActivate={handleActivate}
                renderItem={(item) => (
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkImage
                            iconName={item?.iconName ?? "application-x-executable-symbolic"}
                            iconSize={Gtk.IconSize.LARGE}
                        />
                        <GtkLabel label={item?.name ?? ""} />
                    </GtkBox>
                )}
            >
                {apps.map((app) => (
                    <x.ListItem key={app.id} id={app.id} value={app} />
                ))}
            </x.ListView>
        </GtkScrolledWindow>
    );
};

export const listviewApplauncherDemo: Demo = {
    id: "listview-applauncher",
    title: "Lists/Application launcher",
    description:
        "This demo uses the GtkListView widget as a fancy application launcher. It is also a very small introduction to listviews.",
    keywords: ["listview", "launcher", "apps", "icons", "GtkListView", "GAppInfo", "GListModel"],
    component: ListViewApplauncherDemo,
    sourceCode,
};
