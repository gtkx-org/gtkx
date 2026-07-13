import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkButton, GtkCheckButton, GtkDragSource, GtkDropTarget, GtkToggleButton } from "@gtkx/jsx/gtk";
import { escapeMarkup, formatDue } from "../format.js";
import type { Task } from "../types.js";

export type TaskRowHandlers = {
    onToggleDone: (id: string, done: boolean) => void;
    onToggleImportant: (id: string, important: boolean) => void;
    onDelete: (task: Task) => void;
    onOpen: (id: string) => void;
    onReorder: (draggedId: string, targetId: string) => void;
};

type TaskRowProps = TaskRowHandlers & {
    task: Task;
    reorderable: boolean;
};

export const TaskRow = ({
    task,
    reorderable,
    onToggleDone,
    onToggleImportant,
    onDelete,
    onOpen,
    onReorder,
}: TaskRowProps) => {
    const title = task.done ? `<s>${escapeMarkup(task.title)}</s>` : escapeMarkup(task.title);

    return (
        <AdwActionRow
            title={title}
            useMarkup
            subtitle={formatDue(task.due) ?? undefined}
            activatable
            onActivated={() => onOpen(task.id)}
            prefix={
                <GtkCheckButton
                    valign={Gtk.Align.CENTER}
                    active={task.done}
                    accessibleLabel="Mark complete"
                    onToggled={(self) => onToggleDone(task.id, self.active)}
                />
            }
            suffix={
                <>
                    <GtkToggleButton
                        valign={Gtk.Align.CENTER}
                        iconName={task.important ? "starred-symbolic" : "non-starred-symbolic"}
                        active={task.important}
                        accessibleLabel="Toggle important"
                        cssClasses={["flat"]}
                        onToggled={(self) => onToggleImportant(task.id, self.active)}
                    />
                    <GtkButton
                        valign={Gtk.Align.CENTER}
                        iconName="user-trash-symbolic"
                        accessibleLabel="Delete task"
                        cssClasses={["flat"]}
                        onClicked={() => onDelete(task)}
                    />
                </>
            }
            controllers={
                reorderable ? (
                    <>
                        <GtkDragSource
                            actions={Gdk.DragAction.MOVE}
                            onPrepare={() =>
                                Gdk.ContentProvider.newForValue(
                                    GObject.buildValue(GObject.TYPE_STRING, (value) => value.setString(task.id)),
                                )
                            }
                        />
                        <GtkDropTarget
                            actions={Gdk.DragAction.MOVE}
                            types={[GObject.TYPE_STRING]}
                            onDrop={(value) => {
                                const draggedId = value.getString();
                                if (draggedId) onReorder(draggedId, task.id);
                                return true;
                            }}
                        />
                    </>
                ) : undefined
            }
        />
    );
};
