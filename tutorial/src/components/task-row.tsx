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
import { type RefObject, useRef, useState } from "react";
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

const didHandleReorderKey = (
    task: Task,
    adjacent: { previousId?: string; nextId?: string },
    key: { keyval: number; state: Gdk.ModifierType },
): boolean => {
    if ((key.state & Gdk.ModifierType.ALT_MASK) === 0) {
        return Gdk.EVENT_PROPAGATE;
    }
    if (key.keyval !== Gdk.KEY_Up && key.keyval !== Gdk.KEY_Down) {
        return Gdk.EVENT_PROPAGATE;
    }
    const targetId = key.keyval === Gdk.KEY_Up ? adjacent.previousId : adjacent.nextId;
    if (targetId === undefined) {
        return Gdk.EVENT_PROPAGATE;
    }
    useStore.getState().reorder(task.id, targetId);

    return Gdk.EVENT_STOP;
};

const didDropTask = (task: Task, value: GObject.Value): boolean => {
    const draggedId = value.getString();
    if (draggedId === null || useStore.getState().tasks.every((candidate) => candidate.id !== draggedId)) {
        return false;
    }
    useStore.getState().reorder(draggedId, task.id);

    return true;
};

const TaskActions = ({ task }: { task: Task }) => {
    const requestDeleteTask = useRequestDeleteTask();
    const setImportant = useStore((state) => state.setImportant);

    return (
        <>
            <GtkToggleButton
                valign={Gtk.Align.CENTER}
                iconName={task.important ? "starred-symbolic" : "non-starred-symbolic"}
                active={task.important}
                accessibleLabel={t("Toggle important")}
                cssClasses={["flat"]}
                onToggled={(self) => {
                    setImportant(task.id, self.active);
                }}
            />
            <GtkButton
                valign={Gtk.Align.CENTER}
                iconName="user-trash-symbolic"
                accessibleLabel={t("Delete task")}
                cssClasses={["flat"]}
                onClicked={() => {
                    requestDeleteTask(task);
                }}
            />
        </>
    );
};

const TaskCompletion = ({ task }: { task: Task }) => {
    const setDone = useStore((state) => state.setDone);

    return (
        <GtkCheckButton
            valign={Gtk.Align.CENTER}
            active={task.done}
            accessibleLabel={t("Mark complete")}
            onToggled={(self) => {
                setDone(task.id, self.active);
            }}
        />
    );
};

type ReorderControllersProps = Pick<TaskRowProps, "nextId" | "previousId" | "task"> & {
    paintableRef: RefObject<Gtk.WidgetPaintable | null>;
};

const ReorderControllers = ({ task, previousId, nextId, paintableRef }: ReorderControllersProps) => (
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
            onDrop={(value) => didDropTask(task, value)}
        />
        <GtkEventControllerKey
            onKeyPressed={(keyval, _keycode, state) =>
                didHandleReorderKey(task, { previousId, nextId }, { keyval, state })}
        />
    </>
);

const TaskRow = ({ task, canReorder, previousId, nextId }: TaskRowProps) => {
    const [row, setRow] = useState<Adw.ActionRow | null>(null);
    const paintableRef = useRef<Gtk.WidgetPaintable | null>(null);
    const navigation = useNavigation();
    const escapedTitle = markupEscapeText(task.title, -1);
    const title = task.done ? `<s>${escapedTitle}</s>` : escapedTitle;

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
                onActivated={() => {
                    navigation.navigate("Task", { id: task.id });
                }}
                prefix={<TaskCompletion task={task} />}
                suffix={<TaskActions task={task} />}
                controllers={
                    canReorder
                        ? (
                                <ReorderControllers
                                    task={task}
                                    previousId={previousId}
                                    nextId={nextId}
                                    paintableRef={paintableRef}
                                />
                            )
                        : undefined
                }
            />
        </>
    );
};

export {
    TaskRow,
};
