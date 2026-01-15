import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkImage, GtkLabel, GtkScrolledWindow, GtkSearchEntry, x } from "@gtkx/react";
import { useEffect, useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-applauncher.tsx?raw";

interface AppItem {
    id: string;
    name: string;
    iconName: string;
    description: string;
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
    const [searchText, setSearchText] = useState("");

    useEffect(() => {
        const allApps = Gio.appInfoGetAll();
        const appItems: AppItem[] = allApps
            .filter((app) => app.shouldShow())
            .map((app) => ({
                id: app.getId() ?? app.getName(),
                name: app.getDisplayName(),
                iconName: getIconName(app.getIcon()),
                description: app.getDescription() ?? "",
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
        setApps(appItems);
    }, []);

    const filteredApps = useMemo(() => {
        if (searchText === "") return apps;
        const lower = searchText.toLowerCase();
        return apps.filter(
            (app) => app.name.toLowerCase().includes(lower) || app.description.toLowerCase().includes(lower),
        );
    }, [apps, searchText]);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} vexpand hexpand>
            <GtkBox marginStart={12} marginEnd={12} marginTop={12} marginBottom={8}>
                <GtkSearchEntry
                    text={searchText}
                    placeholderText="Search applications..."
                    onSearchChanged={(entry) => setSearchText(entry.getText())}
                    hexpand
                />
            </GtkBox>

            <GtkLabel
                label={`${filteredApps.length} applications`}
                cssClasses={["dim-label"]}
                halign={Gtk.Align.START}
                marginStart={12}
                marginBottom={8}
            />

            <GtkScrolledWindow vexpand hexpand>
                <x.GridView<AppItem>
                    estimatedItemHeight={100}
                    minColumns={3}
                    maxColumns={8}
                    renderItem={(item) => (
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={4}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            widthRequest={80}
                            marginTop={8}
                            marginBottom={8}
                            marginStart={4}
                            marginEnd={4}
                        >
                            <GtkImage iconName={item?.iconName ?? "application-x-executable-symbolic"} pixelSize={48} />
                            <GtkLabel
                                label={item?.name ?? ""}
                                ellipsize={3}
                                maxWidthChars={12}
                                lines={2}
                                halign={Gtk.Align.CENTER}
                            />
                        </GtkBox>
                    )}
                >
                    {filteredApps.map((app) => (
                        <x.ListItem key={app.id} id={app.id} value={app} />
                    ))}
                </x.GridView>
            </GtkScrolledWindow>
        </GtkBox>
    );
};

export const listviewApplauncherDemo: Demo = {
    id: "listview-applauncher",
    title: "Lists/Application launcher",
    description:
        "This demo shows a grid view with applications installed on the system. The applications are loaded using g_app_info_get_all().",
    keywords: ["gridview", "launcher", "apps", "icons", "GtkGridView", "grid", "GAppInfo"],
    component: ListViewApplauncherDemo,
    sourceCode,
};
