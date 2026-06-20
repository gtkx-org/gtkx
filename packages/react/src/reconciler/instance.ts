import { WRAPPER_NODE_ELEMENT } from "@gtkx/config";
import { constructWrapper, type GType, type GTyped } from "@gtkx/ffi";
import type * as GObject from "@gtkx/gi/gobject";
import { type AnyClass, omit } from "@gtkx/utils";
import { collectConstructableProps } from "../utils/gtype.js";
import { requireClassByName, resolveBackingClass } from "../utils/gtype-predicates.js";
import { type Node, registerState } from "./state.js";
import type { ContainerInfo, Props } from "./types.js";
import { createWrapperElement } from "./wrapper-element.js";

export { WRAPPER_NODE_ELEMENT };

export const CONSTRUCTION_SKIP_PROPS: Record<string, string[]> = {
    GtkStack: ["visibleChildName"],
    AdwViewStack: ["visibleChildName"],
    AdwToggleGroup: ["activeName", "active"],
};

export const resolveContainerClass = (type: string): AnyClass<GTyped> | null => resolveBackingClass(type);

const pickConstructProps = (gtype: GType, props: Props): Props => {
    const constructable = collectConstructableProps(gtype);
    const result: Props = {};
    for (const name in props) {
        if (constructable.has(name)) result[name] = props[name];
    }
    return result;
};

const constructBacking = (type: string, props: Props): GObject.Object => {
    const cls = requireClassByName(type);
    const skip = CONSTRUCTION_SKIP_PROPS[type];
    const picked = pickConstructProps(cls.prototype.__gtype__, skip ? omit(props, skip) : props);
    return constructWrapper(cls, picked) as GObject.Object;
};

export const createElementInstance = (
    type: string,
    props: Props,
    rootContainer: ContainerInfo,
    existing?: GObject.Object,
): Node => {
    const node = existing ?? constructBacking(type, props);
    registerState(node, { name: type, props, rootContainer });
    return node;
};

export const createWrapperInstance = (kind: string, props: Props, rootContainer: ContainerInfo): Node => {
    const node = createWrapperElement();
    registerState(node, { kind, props, rootContainer });
    return node;
};
