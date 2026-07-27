import { ListView } from "@gtkx/components";
import * as Adw from "@gtkx/gi/adw";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkImage, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useParentWindow } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-applauncher.tsx?raw";

type AppItem = {
    appInfo: Gio.AppInfo;
    id: string;
    name: string;
    icon: Gio.Icon | null;
};

const listviewApplauncherDemo: Demo = {
    id: "listview-applauncher",
    title: "Lists/Application launcher",
    description:
        "This demo uses the GtkListView widget as a fancy application launcher." +
        "\n\nIt is also a very small introduction to listviews.",
    keywords: ["GtkListItemFactory", "GListModel"],
    component: ListViewApplauncherDemo,
    sourceCode,
    defaultWidth: 640,
    defaultHeight: 320,
    windowTitle: "Application Launcher",
};

function renderAppItem({ item }: { item: AppItem }) {
    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
            <GtkImage
                {...(item.icon ? { gicon: item.icon } : { iconName: "application-x-executable" })}
                iconSize={Gtk.IconSize.LARGE}
                accessibleLabel="App icon"
            />
            <GtkLabel accessibleLabel={item.name}>{item.name}</GtkLabel>
        </GtkBox>
    );
}

function presentLaunchError(app: AppItem, error: unknown, parentWindow: Gtk.Window | null) {
    const dialog = new Adw.AlertDialog();
    dialog.setHeading(`Could not launch ${app.name}`);
    dialog.setBody(error instanceof Error ? error.message : String(error));
    dialog.addResponse("ok", "_OK");
    dialog.setDefaultResponse("ok");
    dialog.setCloseResponse("ok");
    dialog.present(parentWindow);
}

function launchApp(app: AppItem, parentWindow: Gtk.Window | null) {
    const display = Gdk.Display.getDefault();

    if (!display) {
        return;
    }

    const context = display.getAppLaunchContext();

    try {
        app.appInfo.launch(null, context);
    } catch (error) {
        presentLaunchError(app, error, parentWindow);
    }
}

function ListViewApplauncherDemo() {
    const parentWindow = useParentWindow();

    const apps = Gio.AppInfo.getAll().map((app) => ({
        appInfo: app,
        id: app.getId() ?? crypto.randomUUID(),
        name: app.getDisplayName(),
        icon: app.getIcon(),
    }));

    const handleActivate = (position: number) => {
        const app = apps[position];

        if (app) {
            launchApp(app, parentWindow);
        }
    };

    return (
        <GtkScrolledWindow name="scrolled" vexpand hexpand>
            <ListView
                name="list-view"
                estimatedItemHeight={48}
                selectionMode={Gtk.SelectionMode.SINGLE}
                onActivate={handleActivate}
                renderItem={renderAppItem}
                items={apps.map((app) => ({ id: app.id, value: app }))}
            />
        </GtkScrolledWindow>
    );
}

export { listviewApplauncherDemo };
