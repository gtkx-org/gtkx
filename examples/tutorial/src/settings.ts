import * as Adw from "@gtkx/gi/adw";
import { t } from "@gtkx/i18n";
import schema from "../data/com.gtkx.tutorial.gschema.xml";

type ColorScheme = typeof schema.values["color-scheme"][number];
type SortOrder = keyof typeof schema.values["sort-order"];
type SortOrderValue = typeof schema.values["sort-order"][SortOrder];

const COLOR_SCHEMES = {
    default: { label: () => t("Follow system"), value: Adw.ColorScheme.DEFAULT },
    light: { label: () => t("Light"), value: Adw.ColorScheme.FORCE_LIGHT },
    dark: { label: () => t("Dark"), value: Adw.ColorScheme.FORCE_DARK },
} as const satisfies Record<ColorScheme, { label: () => string; value: Adw.ColorScheme }>;

const SORT_ORDERS = {
    manual: () => t("Manual"),
    ["due-date"]: () => t("Due date"),
    title: () => t("Title"),
    created: () => t("Date created"),
} satisfies Record<SortOrder, () => string>;

const sortOrderIds = Object.keys(SORT_ORDERS) as SortOrder[];

const colorSchemeItems = (): { id: string; value: string }[] =>
    Object.entries(COLOR_SCHEMES).map(([id, choice]) => ({ id, value: choice.label() }));

const sortOrderItems = (): { id: string; value: string }[] =>
    sortOrderIds.map((id) => ({ id, value: SORT_ORDERS[id]() }));

const colorSchemeValue = (id: string): Adw.ColorScheme => COLOR_SCHEMES[id as ColorScheme].value;

const sortOrderFromSetting = (value: SortOrderValue): SortOrder =>
    sortOrderIds.find((id) => schema.values["sort-order"][id] === value) as SortOrder;

const sortOrderToSetting = (order: SortOrder): SortOrderValue => schema.values["sort-order"][order];

export {
    type ColorScheme,
    colorSchemeItems,
    colorSchemeValue,
    type SortOrder,
    sortOrderFromSetting,
    sortOrderItems,
    sortOrderToSetting,
};
