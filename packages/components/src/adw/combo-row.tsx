import type { ReactNode } from "react";
import { AdwComboRow } from "@gtkx/jsx/adw";
import type { DropDownBaseProps } from "../internal/drop-down.js";
import type { ComboRowProps } from "./types.js";
import { DropDownBase } from "../internal/drop-down.js";

/** Call signature of {@link ComboRow}, generic in the item and section value types. */
type ComboRowComponent = <T = unknown, S = unknown>(props: ComboRowProps<T, S>) => ReactNode;

/**
 * Renders an `Adw.ComboRow` backed by a collection model, presenting the same choice as a
 * `DropDown` in the shape of a preferences row, with customizable renderers for the row
 * display, popup rows, and popup section headers, and controlled selection.
 */
const ComboRow: ComboRowComponent = ComboRowImpl as ComboRowComponent;

function ComboRowImpl(props: DropDownBaseProps): ReactNode {
    return <DropDownBase {...props} component={AdwComboRow} />;
}

export { ComboRow };
