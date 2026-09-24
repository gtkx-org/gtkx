import { useSetting } from "@gtkx/react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { useAppSettings } from "../components/settings.js";
import { type SortOrder, sortOrderFromSetting, sortOrderToSetting } from "../settings.js";

const useSortOrder = (): [SortOrder, (order: SortOrder) => void] => {
    const settings = useAppSettings();
    const [value, setValue] = useSetting(settings, schema, "sort-order");

    return [sortOrderFromSetting(value), (order) => {
        setValue(sortOrderToSetting(order));
    }];
};

export {
    useSortOrder,
};
