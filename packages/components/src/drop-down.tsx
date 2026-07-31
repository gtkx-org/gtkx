import type { ReactNode } from "react";
import { GtkDropDown } from "@gtkx/jsx/gtk";
import type { DropDownBaseProps } from "./internal/drop-down.js";
import type { DropDownProps } from "./types.js";
import { DropDownBase } from "./internal/drop-down.js";

/** Call signature of {@link DropDown}, generic in the item and section value types. */
type DropDownComponent = <T = unknown, S = unknown>(props: DropDownProps<T, S>) => ReactNode;

/**
 * Renders a `Gtk.DropDown` backed by a collection model, with customizable renderers for the
 * collapsed display, popup rows, and popup section headers, and controlled selection.
 */
const DropDown: DropDownComponent = DropDownImpl as DropDownComponent;

function DropDownImpl(props: DropDownBaseProps): ReactNode {
    return <DropDownBase {...props} component={GtkDropDown} />;
}

export { DropDown };
