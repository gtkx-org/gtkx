import type * as Adw from "@gtkx/gi/adw";
import { AdwComboRow, type AdwComboRowProps } from "@gtkx/jsx/adw";
import type { ReactNode } from "react";
import { DropDownBody, type DropDownDeclarativeProps } from "./drop-down.js";

export type ComboRowProps<T = unknown, S = unknown> = Omit<
    AdwComboRowProps,
    keyof DropDownDeclarativeProps<T, S> | "model" | "factory" | "listFactory" | "headerFactory"
> &
    DropDownDeclarativeProps<T, S>;

export const ComboRow = <T = unknown, S = unknown>(props: ComboRowProps<T, S>): ReactNode => (
    <DropDownBody<T, S, Adw.ComboRow> element={AdwComboRow} props={props} />
);
