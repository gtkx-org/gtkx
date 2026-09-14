import { useSetting } from "@gtkx/react";
import { useAppSettings } from "../components/settings.js";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { sortOrderFromSetting, type SortOrder, sortOrderToSetting } from "../settings.js";

export const useSortOrder = (): [SortOrder, (order: SortOrder) => void] => {
    const settings = useAppSettings();
    const [value, setValue] = useSetting(settings, schema, "sort-order");
    return [sortOrderFromSetting(value), (order) => setValue(sortOrderToSetting(order))];
};
