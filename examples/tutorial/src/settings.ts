import * as Adw from "@gtkx/gi/adw";
import { t } from "@gtkx/i18n";

const COLOR_SCHEMES = {
    default: { label: () => t("Follow system"), value: Adw.ColorScheme.DEFAULT },
    light: { label: () => t("Light"), value: Adw.ColorScheme.FORCE_LIGHT },
    dark: { label: () => t("Dark"), value: Adw.ColorScheme.FORCE_DARK },
} as const;

const SORT_ORDERS = {
    manual: () => t("Manual"),
    "due-date": () => t("Due date"),
    title: () => t("Title"),
    created: () => t("Date created"),
} as const;

export type ColorScheme = keyof typeof COLOR_SCHEMES;
export type SortOrder = keyof typeof SORT_ORDERS;

const sortOrderIds = Object.keys(SORT_ORDERS) as SortOrder[];

export const colorSchemeItems = (): { id: string; value: string }[] =>
    Object.entries(COLOR_SCHEMES).map(([id, choice]) => ({ id, value: choice.label() }));

export const sortOrderItems = (): { id: string; value: string }[] =>
    sortOrderIds.map((id) => ({ id, value: SORT_ORDERS[id]() }));

export const colorSchemeValue = (id: string): Adw.ColorScheme => COLOR_SCHEMES[id as ColorScheme].value;

export const sortOrderFromSetting = (value: number): SortOrder => sortOrderIds[value];

export const sortOrderToSetting = (order: SortOrder): number => sortOrderIds.indexOf(order);
