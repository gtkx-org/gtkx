import * as Gdk from "@gtkx/ffi/gdk";
import * as Gio from "@gtkx/ffi/gio";
import "@gtkx/ffi/giounix";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkImage, GtkLabel, GtkListView, GtkScrolledWindow, x } from "@gtkx/react";
import { useCallback, useEffect, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-applauncher.tsx?raw";

interface AppItem {
    appInfo: Gio.AppInfo;
    id: string;
    name: string;
    icon: Gio.Icon | null;
}

const ListViewApplauncherDemo = () => {
    const [apps, setApps] = useState<AppItem[]>([]);

    useEffect(() => {
        const allApps = Gio.appInfoGetAll();
        const appItems: AppItem[] = allApps.map((app) => ({
            appInfo: app,
            id: app.getId() ?? crypto.randomUUID(),
            name: app.getDisplayName(),
            icon: app.getIcon(),
        }));
        setApps(appItems);
    }, []);

    const handleActivate = useCallback(
        (position: number) => {
            const app = apps[position];
            if (!app) return;

            const display = Gdk.Display.getDefault();
            if (!display) return;

            const context = display.getAppLaunchContext();
            try {
                app.appInfo.launch(null, context);
            } catch (error) {
                const dialog = new Gtk.AlertDialog();
                dialog.setMessage(`Could not launch ${app.name}`);
                dialog.setDetail(error instanceof Error ? error.message : String(error));
                dialog.show(null);
            }
        },
        [apps],
    );

    return (
        <GtkScrolledWindow vexpand hexpand>
            <GtkListView
                estimatedItemHeight={48}
                selectionMode={Gtk.SelectionMode.SINGLE}
                onActivate={handleActivate}
                renderItem={(item: AppItem | null) => (
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkImage
                            {...(item?.icon ? { gicon: item.icon } : { iconName: "application-x-executable" })}
                            iconSize={Gtk.IconSize.LARGE}
                            accessibleLabel="App icon"
                        />
                        <GtkLabel label={item?.name ?? ""} accessibleLabel={item?.name ?? ""} />
                    </GtkBox>
                )}
            >
                {apps.map((app) => (
                    <x.ListItem key={app.id} id={app.id} value={app} />
                ))}
            </GtkListView>
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
    defaultWidth: 640,
    defaultHeight: 320,
};
