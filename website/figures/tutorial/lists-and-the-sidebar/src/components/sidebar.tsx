import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkBox, GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { SplitViewScreenProps } from "@gtkx/navigation";
import { type RootParamList, useSelection } from "../navigation.js";
import { useStore } from "../store/index.js";
import { listDot } from "../styles.js";

export const Sidebar = ({
    navigation,
}: SplitViewScreenProps<RootParamList, "Lists">) => {
    const lists = useStore((state) => state.lists);
    const selection = useSelection();

    const activeIndex = lists.findIndex(
        (list) => list.id === selection?.listId,
    );

    return (
        <GtkScrolledWindow vexpand>
            <GtkListBox
                cssClasses={["navigation-sidebar"]}
                selectedIndex={activeIndex}
                onRowSelected={(row) => {
                    if (!row) return;
                    const list = lists[row.getIndex()];
                    if (list) {
                        navigation.navigate("Tasks", {
                            kind: "list",
                            listId: list.id,
                        });
                    }
                }}
            >
                {lists.map((list) => (
                    <AdwActionRow
                        key={list.id}
                        title={list.name}
                        useMarkup={false}
                        prefix={
                            <GtkBox
                                valign={Gtk.Align.CENTER}
                                cssClasses={[listDot(list.color)]}
                                accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                            />
                        }
                    />
                ))}
            </GtkListBox>
        </GtkScrolledWindow>
    );
};
