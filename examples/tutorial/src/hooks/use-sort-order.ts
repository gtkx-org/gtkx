import { useSetting } from "@gtkx/react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { type SortOrder, SortValue } from "../types.js";

export const useSortOrder = (): [SortOrder, (order: SortOrder) => void] => {
    const [value, setValue] = useSetting(schema, "sort-order");
    return [SortValue[value] as SortOrder, (order) => setValue(SortValue[order])];
};
