import * as GObject from "@gtkx/gi/gobject";
import type { RefObject } from "react";

export type GObjectTarget<T extends GObject.Object> = T | RefObject<T | null> | null | undefined;

export const resolveGObjectTarget = <T extends GObject.Object>(target: GObjectTarget<T>): T | null => {
    if (!target) return null;
    if (target instanceof GObject.Object) return target;
    return target.current;
};
