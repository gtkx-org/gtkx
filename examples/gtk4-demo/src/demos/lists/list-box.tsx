import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkListBox, GtkListBoxRow, GtkScrolledWindow } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const items = [
    { id: 1, title: "Inbox", subtitle: "23 unread messages" },
    { id: 2, title: "Starred", subtitle: "5 starred items" },
    { id: 3, title: "Sent", subtitle: "Last sent 2 hours ago" },
    { id: 4, title: "Drafts", subtitle: "3 drafts" },
    { id: 5, title: "Archive", subtitle: "1,234 archived items" },
    { id: 6, title: "Spam", subtitle: "12 spam messages" },
    { id: 7, title: "Trash", subtitle: "Empty" },
];

const ListBoxDemo = () => {
    const [selectedId, setSelectedId] = useState<number | null>(null);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="List GtkBox" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About ListBox" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkListBox is a vertical container that displays selectable rows. It's ideal for lists with custom row layouts and supports selection, activation, and keyboard navigation."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Selectable List" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkScrolledWindow heightRequest={250} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <GtkListBox selectionMode={Gtk.SelectionMode.SINGLE} cssClasses={["boxed-list"]}>
                        {items.map((item) => (
                            <GtkListBoxRow
                                key={item.id}
                                onActivate={() => setSelectedId(item.id)}
                                cssClasses={selectedId === item.id ? ["selected"] : []}
                            >
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={4}
                                    marginStart={12}
                                    marginEnd={12}
                                    marginTop={10}
                                    marginBottom={10}
                                >
                                    <GtkLabel label={item.title} halign={Gtk.Align.START} cssClasses={["heading"]} />
                                    <GtkLabel
                                        label={item.subtitle}
                                        halign={Gtk.Align.START}
                                        cssClasses={["dim-label", "caption"]}
                                    />
                                </GtkBox>
                            </GtkListBoxRow>
                        ))}
                    </GtkListBox>
                </GtkScrolledWindow>
                {selectedId && (
                    <GtkLabel
                        label={`Selected: ${items.find((i) => i.id === selectedId)?.title ?? ""}`}
                        cssClasses={["dim-label"]}
                    />
                )}
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Selection Modes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkListBox supports NONE, SINGLE, BROWSE, and MULTIPLE selection modes."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const listBoxDemo: Demo = {
    id: "listbox",
    title: "List GtkBox",
    description: "Vertical list with selectable rows and custom layouts.",
    keywords: ["list", "listbox", "selection", "rows", "GtkListBox"],
    component: ListBoxDemo,
    sourcePath: getSourcePath(import.meta.url, "list-box.tsx"),
};
