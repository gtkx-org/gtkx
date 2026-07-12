import type * as Adw from "@gtkx/gi/adw";
import { AdwComboRow, type AdwComboRowProps } from "@gtkx/jsx/adw";
import type { ReactNode } from "react";
import { DropDownBody, type DropDownDeclarativeProps } from "./drop-down.js";

/** Props for {@link ComboRow}, combining Adw.ComboRow props with {@link DropDownDeclarativeProps}. */
export type ComboRowProps<T = unknown, S = unknown> = Omit<
    AdwComboRowProps,
    keyof DropDownDeclarativeProps<T, S> | "model" | "factory" | "listFactory" | "headerFactory"
> &
    DropDownDeclarativeProps<T, S>;

/**
 * Renders an Adw.ComboRow: a preferences-style row wrapping a drop-down, backed by a
 * collection model with the same declarative rendering as {@link DropDown}.
 */
export const ComboRow = <T = unknown, S = unknown>(props: ComboRowProps<T, S>): ReactNode => (
    <DropDownBody<T, S, Adw.ComboRow> element={AdwComboRow} props={props} />
);
