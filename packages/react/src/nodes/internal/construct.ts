import { getNativeClassByName } from "@gtkx/ffi";
import { ColumnController } from "../../components/internal/column-controller.js";
import { setColumnController } from "../../components/internal/column-view-registry.js";
import type { ColumnViewColumnProps } from "../../jsx.js";
import type { BackingInstance, Props } from "../../types.js";

const COLUMN_VIEW_COLUMN_TYPE = "GtkColumnViewColumn";

/**
 * Builds the backing `Gtk.ColumnViewColumn` of a `<GtkColumnViewColumn>` element
 * by constructing its {@link ColumnController}, which owns the cell factory the
 * column is constructed with, then records the controller against the column so
 * the element map and prop descriptor can reach it.
 *
 * @param props - The column's React prop bag.
 */
function constructColumnViewColumn(props: Props): BackingInstance {
    const controller = ColumnController.build(props as ColumnViewColumnProps);
    const column = controller.getColumn();
    setColumnController(column, controller);
    return column;
}

/**
 * Instantiates the backing GObject of a reconciler element, widget or not.
 *
 * Resolves the registered wrapper class for the GLib type and constructs it
 * with the camelCase JSX prop bag. The generated constructor translates each
 * known property into a `GValue` and ignores everything else (signal
 * handlers, children, refs), so the bag can be passed through verbatim. A
 * `GtkColumnViewColumn` follows a bespoke path so its cell factory exists at
 * construction.
 *
 * @param typeName - GLib type name (e.g. `"GtkLabel"`)
 * @param props - React prop bag; only construct-time properties are picked
 *   up, all others are ignored at construction
 */
export function createContainerWithProperties(typeName: string, props: Props): BackingInstance {
    if (typeName === COLUMN_VIEW_COLUMN_TYPE) return constructColumnViewColumn(props);
    const cls = getNativeClassByName(typeName);
    if (!cls) {
        throw new Error(`createContainerWithProperties: no registered class for GLib type '${typeName}'`);
    }
    return new (cls as new (props: Record<string, unknown>) => BackingInstance)(props as Record<string, unknown>);
}
