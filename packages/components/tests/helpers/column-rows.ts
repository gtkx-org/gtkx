import * as Gtk from "@gtkx/gi/gtk";
import { within } from "@gtkx/testing";

const allRows = (view: Gtk.ColumnView): Gtk.Widget[] => within(view).getAllByRole(Gtk.AccessibleRole.ROW);
const dataRows = (view: Gtk.ColumnView): Gtk.Widget[] => allRows(view).slice(1);

export { allRows, dataRows };
