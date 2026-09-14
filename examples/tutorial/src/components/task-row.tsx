import type * as Adw from "@gtkx/gi/adw";
import * as Gdk from "@gtkx/gi/gdk";
import { markupEscapeText } from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { t } from "@gtkx/i18n";
import { AdwActionRow } from "@gtkx/jsx/adw";
import {
    GtkButton,
    GtkCheckButton,
    GtkDragSource,
    GtkDropTarget,
    GtkEventControllerKey,
    GtkToggleButton,
    GtkWidgetPaintable,
} from "@gtkx/jsx/gtk";
import { useNavigation } from "@gtkx/navigation";
import { createPortal, rootElement } from "@gtkx/react";
import { useRef, useState } from "react";
import type { Task } from "../types.js";
import { formatDue } from "../format.js";
import { useStore } from "../store/index.js";
import { useRequestDeleteTask } from "./dialogs.js";

type TaskRowProps = {
    task: Task;
    canReorder: boolean;
    previousId?: string;
    nextId?: string;
};

export const TaskRow = ({ task, canReorder, previousId, nextId }: TaskRowProps) => {
    const [row, setRow] = useState<Adw.ActionRow | null>(null);
    const paintableRef = useRef<Gtk.WidgetPaintable | null>(null);
    const requestDeleteTask = useRequestDeleteTask();
    const navigation = useNavigation();
    const setDone = useStore((state) => state.setDone);
    const setImportant = useStore((state) => state.setImportant);
    const reorder = useStore((state) => state.reorder);
    const escapedTitle = markupEscapeText(task.title, -1);
    const title = task.done ? `<s>${escapedTitle}</s>` : escapedTitle;
    const handleReorderKey = (keyval: number, state: Gdk.ModifierType): boolean => {
        if ((state & Gdk.ModifierType.ALT_MASK) === 0) return Gdk.EVENT_PROPAGATE;
        if (keyval !== Gdk.KEY_Up && keyval !== Gdk.KEY_Down) return Gdk.EVENT_PROPAGATE;
        const targetId = keyval === Gdk.KEY_Up ? previousId : nextId;
        if (targetId === undefined) return Gdk.EVENT_PROPAGATE;
        reorder(task.id, targetId);
        return Gdk.EVENT_STOP;
    };

    return (
        <>
            {canReorder &&
                createPortal(
                    <GtkWidgetPaintable ref={paintableRef} widget={row as Gtk.Widget | null} />,
                    rootElement,
                )}
            <AdwActionRow
                ref={setRow}
                title={title}
                useMarkup
                subtitle={formatDue(task.due) ?? undefined}
                activatable
                accessibleKeyShortcuts={canReorder ? "Alt+Up Alt+Down" : null}
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
                                    self.setIcon(paintableRef.current, Math.round(x), Math.round(y));
                                    return Gdk.ContentProvider.newForValue(task.id);
                                }}
                            />
                            <GtkDropTarget
                                actions={Gdk.DragAction.MOVE}
                                types={[GObject.TYPE_STRING]}
                                onDrop={(value) => {
                                    const draggedId = value.getString();
                                    if (
                                        draggedId === null ||
                                        !useStore.getState().tasks.some((candidate) => candidate.id === draggedId)
                                    )
                                        return false;
                                    reorder(draggedId, task.id);
                                    return true;
                                }}
                            />
                            <GtkEventControllerKey
                                onKeyPressed={(keyval, _keycode, state) => handleReorderKey(keyval, state)}
                            />
                        </>
                    ) : undefined
                }
            />
        </>
    );
};
