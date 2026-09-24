import { ListView } from "@gtkx/components";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkBox, GtkImage, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useState } from "react";
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

function launchApp(app: AppItem, onError: (error: unknown) => void) {
    const display = Gdk.Display.getDefault();

    if (!display) {
        return;
    }

    const context: object = display.getAppLaunchContext();

    if (!(context instanceof Gio.AppLaunchContext)) {
        return;
    }

    try {
        app.appInfo.launch(null, context);
    } catch (error) {
        onError(error);
    }
}

function ListViewApplauncherDemo() {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [launchError, setLaunchError] = useState<{ app: AppItem; error: unknown } | null>(null);

    const apps = Gio.AppInfo.getAll().map((app) => ({
        appInfo: app,
        id: app.getId() ?? crypto.randomUUID(),
        name: app.getDisplayName(),
        icon: app.getIcon(),
    }));

    const handleActivate = (position: number) => {
        const app = apps[position];

        if (app) {
            launchApp(app, (error) => {
                setLaunchError({ app, error });
            });
        }
    };

    return (
        <>
            <GtkScrolledWindow name="scrolled" vexpand hexpand>
                <ListView
                    name="list-view"
                    estimatedItemHeight={48}
                    selectionMode={Gtk.SelectionMode.SINGLE}
                    selectedIds={selectedIds}
                    onSelectionChanged={setSelectedIds}
                    onActivate={handleActivate}
                    renderItem={renderAppItem}
                    items={apps.map((app) => ({ id: app.id, value: app }))}
                />
            </GtkScrolledWindow>
            {launchError !== null && (
                <AdwAlertDialog
                    heading={`Could not launch ${launchError.app.name}`}
                    body={launchError.error instanceof Error ? launchError.error.message : String(launchError.error)}
                    responses={[{ id: "ok", label: "_OK" }]}
                    defaultResponse="ok"
                    closeResponse="ok"
                    onClosed={() => {
                        setLaunchError(null);
                    }}
                />
            )}
        </>
    );
}

export { listviewApplauncherDemo };
