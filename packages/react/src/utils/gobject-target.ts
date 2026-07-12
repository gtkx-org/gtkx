import * as GObject from "@gtkx/gi/gobject";
import type { RefObject } from "react";

/**
 * A subscription target accepted by the GObject-aware hooks: a GObject, a ref to one, or a nullish value.
 */
export type GObjectTarget<T extends GObject.Object> = T | RefObject<T | null> | null | undefined;

export const resolveGObjectTarget = <T extends GObject.Object>(target: GObjectTarget<T>): T | null => {
    if (!target) return null;
    if (target instanceof GObject.Object) return target;
    return target.current;
};
