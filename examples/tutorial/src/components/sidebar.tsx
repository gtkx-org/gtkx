import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkBox, GtkImage, GtkLabel, GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useEffect, useRef } from "react";
import type { SidebarCounts } from "../select.js";
import { listDot } from "../styles.js";
import type { Selection, TaskList } from "../types.js";

type Entry = {
    selection: Selection;
    title: string;
    icon?: string;
    color?: string;
    count: number;
};

const keyOf = (selection: Selection): string =>
    selection.kind === "smart" ? `smart:${selection.view}` : `list:${selection.listId}`;

const buildEntries = (lists: TaskList[], counts: SidebarCounts): Entry[] => [
    { selection: { kind: "smart", view: "all" }, title: "All Tasks", icon: "view-list-symbolic", count: counts.all },
    {
        selection: { kind: "smart", view: "today" },
        title: "Today",
        icon: "x-office-calendar-symbolic",
        count: counts.today,
    },
    {
        selection: { kind: "smart", view: "important" },
        title: "Important",
        icon: "starred-symbolic",
        count: counts.important,
    },
    ...lists.map(
        (list): Entry => ({
            selection: { kind: "list", listId: list.id },
            title: list.name,
            color: list.color,
            count: counts.lists[list.id] ?? 0,
        }),
    ),
    { selection: { kind: "smart", view: "trash" }, title: "Trash", icon: "user-trash-symbolic", count: counts.trash },
];

export const Sidebar = ({
    lists,
    counts,
    selection,
    onSelect,
}: {
    lists: TaskList[];
    counts: SidebarCounts;
    selection: Selection;
    onSelect: (selection: Selection) => void;
}) => {
    const entries = buildEntries(lists, counts);
    const activeIndex = entries.findIndex((entry) => keyOf(entry.selection) === keyOf(selection));
    const listRef = useRef<Gtk.ListBox | null>(null);

    useEffect(() => {
        const box = listRef.current;
        if (!box || activeIndex < 0) return;
        const row = box.getRowAtIndex(activeIndex);
        if (row) box.selectRow(row);
    }, [activeIndex]);

    return (
        <GtkScrolledWindow vexpand>
            <GtkListBox
                ref={listRef}
                cssClasses={["navigation-sidebar"]}
                onRowSelected={(row) => {
                    if (!row) return;
                    const entry = entries[row.getIndex()];
                    if (entry && keyOf(entry.selection) !== keyOf(selection)) onSelect(entry.selection);
                }}
            >
                {entries.map((entry) => (
                    <AdwActionRow
                        key={keyOf(entry.selection)}
                        title={entry.title}
                        prefix={
                            entry.color ? (
                                <GtkBox
                                    valign={Gtk.Align.CENTER}
                                    cssClasses={[listDot(entry.color)]}
                                    accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                                />
                            ) : (
                                <GtkImage iconName={entry.icon} />
                            )
                        }
                        suffix={
                            entry.count > 0 ? (
                                <GtkLabel
                                    label={String(entry.count)}
                                    valign={Gtk.Align.CENTER}
                                    cssClasses={["dimmed", "numeric"]}
                                />
                            ) : undefined
                        }
                    />
                ))}
            </GtkListBox>
        </GtkScrolledWindow>
    );
};
