import type * as Adw from "@gtkx/gi/adw";
import { AdwComboRow, type AdwComboRowProps } from "@gtkx/jsx/adw";
import type { ReactNode } from "react";
import { DropDownBody, type DropDownDeclarativeProps, type DropDownRenderItemInfo } from "./drop-down.js";

export type { DropDownRenderItemInfo as ComboRowRenderItemInfo };

export type ComboRowProps<T = unknown, S = unknown> = Omit<AdwComboRowProps, keyof DropDownDeclarativeProps<T, S>> &
    DropDownDeclarativeProps<T, S>;

export const ComboRow = <T = unknown, S = unknown>(props: ComboRowProps<T, S>): ReactNode => (
    <DropDownBody<T, S, Adw.ComboRow> element={AdwComboRow} props={props} />
);
