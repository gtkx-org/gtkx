import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkCheckButton, GtkLabel, GtkListBoxRow } from "@gtkx/react";
import type { Todo } from "./types.js";

type TodoRowProps = {
    todo: Todo;
    onToggle: (id: number) => void;
    onDelete: (id: number) => void;
};

export const TodoRow = ({ todo, onToggle, onDelete }: TodoRowProps) => {
    return (
        <GtkListBoxRow activatable={false} name={`todo-${todo.id}`}>
            <GtkBox
                orientation={Gtk.Orientation.HORIZONTAL}
                spacing={12}
                marginTop={8}
                marginBottom={8}
                marginStart={12}
                marginEnd={12}
            >
                <GtkCheckButton
                    active={todo.completed}
                    onToggled={() => onToggle(todo.id)}
                    name={`toggle-${todo.id}`}
                    valign={Gtk.Align.CENTER}
                />
                <GtkLabel
                    label={todo.text}
                    hexpand
                    xalign={0}
                    name={`text-${todo.id}`}
                    cssClasses={todo.completed ? ["dim-label"] : []}
                    valign={Gtk.Align.CENTER}
                />
                <GtkButton
                    iconName="edit-delete-symbolic"
                    tooltipText="Delete task"
                    cssClasses={["flat", "circular"]}
                    onClicked={() => onDelete(todo.id)}
                    name={`delete-${todo.id}`}
                    valign={Gtk.Align.CENTER}
                />
            </GtkBox>
        </GtkListBoxRow>
    );
};
