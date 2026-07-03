/// <reference types="@gtkx/config/env" />

import { SLOT_PROPS } from "virtual:gtkx-config";
import { getWrapperClassByName } from "@gtkx/ffi";
import { foldInheritedTable } from "../utils/gtype.js";

export const SLOT_HOST_BASE_TYPE: Record<string, string> = {
    controllers: "GtkWidget",
    actionGroups: "GtkWidget",
};

const slotPropsCache = new Map<string, Set<string>>();

const EMPTY_SLOT_PROPS: Set<string> = new Set();

export const slotPropsFor = (elementName: string): Set<string> => {
    const cached = slotPropsCache.get(elementName);
    if (cached) return cached;
    const cls = getWrapperClassByName(elementName);
    const names = cls
        ? foldInheritedTable(
              cls.prototype.__type__,
              SLOT_PROPS,
              (collected: Set<string>, propNames) => {
                  for (const name of propNames) collected.add(name);
                  return collected;
              },
              new Set<string>(),
          )
        : EMPTY_SLOT_PROPS;
    slotPropsCache.set(elementName, names);
    return names;
};
