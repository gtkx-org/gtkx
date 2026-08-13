import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";

const expanderNamed = (name: string): Gtk.TreeExpander =>
    screen.getByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.TreeExpander });

const expanderCount = (): number => screen.queryAllByRole(Gtk.AccessibleRole.BUTTON, { as: Gtk.TreeExpander }).length;

const listRowByName = (name: string): Gtk.TreeListRow => {
    const row = expanderNamed(name).getListRow();

    if (row === null) {
        throw new TypeError("Expected the expander to carry a tree list row");
    }

    return row;
};

export { expanderCount, expanderNamed, listRowByName };
