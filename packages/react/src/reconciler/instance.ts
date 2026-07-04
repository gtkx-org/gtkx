import type { RelationshipKind } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import { collectConstructableProps } from "../utils/gtype.js";
import { requireClassByName } from "../utils/gtype-predicates.js";
import { createRelationshipNode } from "./relationship-node.js";
import { constructionSkipProps } from "./rule-table.js";
import { type Node, registerState } from "./state.js";
import type { Container, Props } from "./types.js";

const pickConstructProps = (gtype: bigint, props: Props): Props => {
    const constructable = collectConstructableProps(gtype);
    const skipped = constructionSkipProps(gtype);
    const result: Props = {};
    for (const name in props) {
        if (constructable.has(name) && !skipped.has(name)) result[name] = props[name];
    }
    return result;
};

const constructWrapperInstance = (type: string, props: Props): GObject.Object => {
    const cls = requireClassByName(type);
    return new cls(pickConstructProps(GObject.typeFromName(type), props));
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
