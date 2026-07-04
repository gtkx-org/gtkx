/// <reference types="@gtkx/config/env" />

import { SLOT_PROPS } from "virtual:gtkx-config";
import { typeFromName } from "@gtkx/gi/gobject";
import { foldInheritedTable } from "../utils/gtype.js";

export const SLOT_HOST_BASE_TYPE: Record<string, string> = {
    controllers: "GtkWidget",
    actionGroups: "GtkWidget",
};

const slotPropsCache = new Map<string, Set<string>>();

export const slotPropsFor = (elementName: string): Set<string> => {
    const cached = slotPropsCache.get(elementName);
    if (cached) return cached;
    const names = foldInheritedTable(
        typeFromName(elementName),
        SLOT_PROPS,
        (collected: Set<string>, propNames) => {
            for (const name of propNames) collected.add(name);
            return collected;
        },
        new Set<string>(),
    );
    slotPropsCache.set(elementName, names);
    return names;
};
