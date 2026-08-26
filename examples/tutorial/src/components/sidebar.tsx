import * as Gtk from "@gtkx/gi/gtk";
import { t } from "@gtkx/i18n";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkBox, GtkImage, GtkLabel, GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { SplitViewScreenProps } from "@gtkx/navigation";
import { type RootParamList, useSelection } from "../navigation.js";
import { useStore } from "../store/index.js";
import { type SidebarCounts, selectionKey, sidebarCounts } from "../store/selectors.js";
import { listDot } from "../styles.js";
import type { Selection, TaskList } from "../types.js";

type Entry = {
    selection: Selection;
    title: string;
    icon?: string;
    color?: string;
    count: number;
};

const buildEntries = (lists: TaskList[], counts: SidebarCounts): Entry[] => [
    {
        selection: { kind: "smart", view: "all" },
        title: t("All Tasks"),
        icon: "view-list-symbolic",
        count: counts.all,
    },
    {
        selection: { kind: "smart", view: "today" },
        title: t("Today"),
        icon: "x-office-calendar-symbolic",
        count: counts.today,
    },
    {
        selection: { kind: "smart", view: "important" },
        title: t("Important"),
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
    {
        selection: { kind: "smart", view: "trash" },
        title: t("Trash"),
        icon: "user-trash-symbolic",
        count: counts.trash,
    },
];

export const Sidebar = ({ navigation }: SplitViewScreenProps<RootParamList, "Lists">) => {
    const tasks = useStore((state) => state.tasks);
    const lists = useStore((state) => state.lists);
    const resetSearch = useStore((state) => state.resetSearch);
    const selection = useSelection();

    const entries = buildEntries(lists, sidebarCounts(tasks, lists));
    const activeKey = selection === null ? null : selectionKey(selection);
    const activeIndex = entries.findIndex((entry) => selectionKey(entry.selection) === activeKey);

    return (
        <GtkScrolledWindow vexpand>
            <GtkListBox
                cssClasses={["navigation-sidebar"]}
                selectedIndex={activeIndex}
                onRowSelected={(row) => {
                    if (!row) return;
                    const entry = entries[row.getIndex()];
                    if (entry) {
                        resetSearch();
                        navigation.navigate("Tasks", entry.selection);
                    }
                }}
            >
                {entries.map((entry) => (
                    <AdwActionRow
                        key={selectionKey(entry.selection)}
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
                                <GtkLabel valign={Gtk.Align.CENTER} cssClasses={["dimmed", "numeric"]}>
                                    {String(entry.count)}
                                </GtkLabel>
                            ) : undefined
                        }
                    />
                ))}
            </GtkListBox>
        </GtkScrolledWindow>
    );
};
