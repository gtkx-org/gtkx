import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { t } from "@gtkx/i18n";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkButton, GtkCheckButton, GtkDragSource, GtkDropTarget, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useNavigation } from "@gtkx/navigation";
import { escapeMarkup, formatDue } from "../format.js";
import { useStore } from "../store/index.js";
import type { Task } from "../types.js";
import { useRequestDeleteTask } from "./dialogs.js";

export const TaskRow = ({ task, canReorder }: { task: Task; canReorder: boolean }) => {
    const requestDeleteTask = useRequestDeleteTask();
    const navigation = useNavigation();
    const setDone = useStore((state) => state.setDone);
    const setImportant = useStore((state) => state.setImportant);
    const reorder = useStore((state) => state.reorder);
    const title = task.done ? `<s>${escapeMarkup(task.title)}</s>` : escapeMarkup(task.title);

    return (
        <AdwActionRow
            title={title}
            useMarkup
            subtitle={formatDue(task.due) ?? undefined}
            activatable
            onActivated={() => navigation.navigate("Task", { id: task.id })}
            prefix={
                <GtkCheckButton
                    valign={Gtk.Align.CENTER}
                    active={task.done}
                    accessibleLabel={t("Mark complete")}
                    onToggled={(self) => setDone(task.id, self.active)}
                />
            }
            suffix={
                <>
                    <GtkToggleButton
                        valign={Gtk.Align.CENTER}
                        iconName={task.important ? "starred-symbolic" : "non-starred-symbolic"}
                        active={task.important}
                        accessibleLabel={t("Toggle important")}
                        cssClasses={["flat"]}
                        onToggled={(self) => setImportant(task.id, self.active)}
                    />
                    <GtkButton
                        valign={Gtk.Align.CENTER}
                        iconName="user-trash-symbolic"
                        accessibleLabel={t("Delete task")}
                        cssClasses={["flat"]}
                        onClicked={() => requestDeleteTask(task)}
                    />
                </>
            }
            controllers={
                canReorder ? (
                    <>
                        <GtkDragSource
                            actions={Gdk.DragAction.MOVE}
                            onPrepare={(x, y, self) => {
                                const row = self.getWidget();
                                if (row) self.setIcon(Gtk.WidgetPaintable.new(row), Math.round(x), Math.round(y));
                                return Gdk.ContentProvider.newForValue(task.id);
                            }}
                        />
                        <GtkDropTarget
                            actions={Gdk.DragAction.MOVE}
                            types={[GObject.TYPE_STRING]}
                            onDrop={(value) => {
                                const draggedId = value.getString();
                                if (draggedId) reorder(draggedId, task.id);
                                return true;
                            }}
                        />
                    </>
                ) : undefined
            }
        />
    );
};
