import * as GLib from "@gtkx/gi/glib";
import { GtkButton } from "@gtkx/jsx/gtk";

export const Toolbar = () => (
    <>
        <GtkButton
            iconName="list-add-symbolic"
            tooltipText="New Note (Ctrl+N)"
            actionName="win.new"
        />
        <GtkButton
            label="Open To-do"
            actionName="win.open"
            actionTarget={GLib.Variant.newString("todo.md")}
        />
    </>
);
