import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkImage, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { formatDue } from "../format.js";
import type { Task } from "../types.js";

export const SelectionView = ({
    tasks,
    selectedIds,
    onSelectionChanged,
}: {
    tasks: Task[];
    selectedIds: string[];
    onSelectionChanged: (ids: string[]) => void;
}) => (
    <GtkScrolledWindow vexpand>
        <ListView<Task>
            items={tasks.map((task) => ({ id: task.id, value: task }))}
            selectionMode={Gtk.SelectionMode.MULTIPLE}
            selectedIds={selectedIds}
            onSelectionChanged={onSelectionChanged}
            estimatedItemHeight={56}
            renderItem={({ item }) => (
                <GtkBox
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={12}
                    marginTop={10}
                    marginBottom={10}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} hexpand halign={Gtk.Align.START}>
                        <GtkLabel label={item.title} halign={Gtk.Align.START} />
                        {item.due ? (
                            <GtkLabel
                                label={formatDue(item.due) ?? ""}
                                halign={Gtk.Align.START}
                                cssClasses={["dimmed", "caption"]}
                            />
                        ) : null}
                    </GtkBox>
                    {item.important ? <GtkImage iconName="starred-symbolic" valign={Gtk.Align.CENTER} /> : null}
                </GtkBox>
            )}
        />
    </GtkScrolledWindow>
);
