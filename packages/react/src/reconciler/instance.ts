import type { WrapperKind } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import { collectConstructableProps, requireClassByName } from "../utils/gtype.js";
import { constructionSkipProps } from "./element-props.js";
import { type Node, registerState } from "./state.js";
import type { Container, Props } from "./types.js";
import { createWrapperNode } from "./wrapper-node.js";

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
    registerState(node, { props, rootContainer });
    return node;
};

export const createWrapperInstance = (kind: WrapperKind, props: Props, rootContainer: Container): Node => {
    const node = createWrapperNode();
    registerState(node, { kind, props, rootContainer });
    return node;
};
