import type { RelationshipKind } from "@gtkx/config";
import { constructWrapper, type GType } from "@gtkx/ffi";
import type * as GObject from "@gtkx/gi/gobject";
import { omit } from "@gtkx/utils";
import { collectConstructableProps } from "../utils/gtype.js";
import { requireClassByName } from "../utils/gtype-predicates.js";
import { createRelationshipNode } from "./relationship-node.js";
import { type Node, registerState } from "./state.js";
import type { Container, Props } from "./types.js";

const CONSTRUCTION_SKIP_PROPS: Record<string, string[]> = {
    GtkStack: ["visibleChildName"],
    AdwViewStack: ["visibleChildName"],
    AdwToggleGroup: ["activeName", "active"],
};

const pickConstructProps = (gtype: GType, props: Props): Props => {
    const constructable = collectConstructableProps(gtype);
    const result: Props = {};
    for (const name in props) {
        if (constructable.has(name)) result[name] = props[name];
    }
    return result;
};

const constructWrapperInstance = (type: string, props: Props): GObject.Object => {
    const cls = requireClassByName(type);
    const skip = CONSTRUCTION_SKIP_PROPS[type];
    const picked = pickConstructProps(cls.prototype.__gtype__, skip ? omit(props, skip) : props);
    return constructWrapper(cls, picked) as GObject.Object;
};

export const createElementInstance = (type: string, props: Props, rootContainer: Container): Node => {
    const node = constructWrapperInstance(type, props);
    registerState(node, { name: type, props, rootContainer });
    return node;
};

export const createRelationshipInstance = (kind: RelationshipKind, props: Props, rootContainer: Container): Node => {
    const node = createRelationshipNode();
    registerState(node, { kind, props, rootContainer });
    return node;
};
