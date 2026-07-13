import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";

export const showShortcutsDialog = (window: Gtk.Window): void => {
    const dialog = new Adw.ShortcutsDialog();

    const general = Adw.ShortcutsSection.new("General");
    general.add(Adw.ShortcutsItem.new("New task", "<Control>n"));
    general.add(Adw.ShortcutsItem.new("Search tasks", "<Control>f"));
    general.add(Adw.ShortcutsItem.new("Preferences", "<Control>comma"));
    general.add(Adw.ShortcutsItem.new("Keyboard shortcuts", "<Control>question"));
    dialog.add(general);

    const tasks = Adw.ShortcutsSection.new("Tasks");
    tasks.add(Adw.ShortcutsItem.new("Delete task", "Delete"));
    tasks.add(Adw.ShortcutsItem.new("Close task", "Escape"));
    dialog.add(tasks);

    dialog.present(window);
};
