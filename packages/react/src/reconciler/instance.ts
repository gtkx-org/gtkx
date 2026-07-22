import * as GObject from "@gtkx/gi/gobject";
import { getWrapperClass } from "@gtkx/runtime";
import { pickBy } from "@gtkx/utils";
import { collectConstructableProps } from "../utils/type-metadata.js";
import { collectConstructionSkipProps } from "./element-props.js";
import { type Node, registerState } from "./state.js";
import type { Container, Props } from "./types.js";
import type { WrapperKind } from "./wrapper-kinds.js";
import { createWrapperNode } from "./wrapper-node.js";

const resolveWrapperClassByName = (typeName: string): (new (props: Record<string, unknown>) => GObject.Object) => {
    const gtype = GObject.typeFromName(typeName);
    if (gtype === GObject.TYPE_INVALID)
        throw new Error(
            `${typeName} is not registered. Import its @gtkx/jsx namespace module (e.g. \`import "@gtkx/jsx/adw"\`) before use.`,
        );
    return getWrapperClass(gtype) as new (
        props: Record<string, unknown>,
    ) => GObject.Object;
};

const pickConstructProps = (gtype: bigint, props: Props): Props => {
    const constructable = collectConstructableProps(gtype);
    const skipped = collectConstructionSkipProps(gtype);
    return pickBy(props, (_value, name) => constructable.has(name) && !skipped.has(name));
};

export const createElementInstance = (type: string, props: Props, rootContainer: Container): Node => {
    const cls = resolveWrapperClassByName(type);
    const node = new cls(pickConstructProps(GObject.typeFromName(type), props));
    registerState(node, { props, rootContainer });
    return node;
};

export const createWrapperInstance = (kind: WrapperKind, props: Props, rootContainer: Container): Node => {
    const node = createWrapperNode();
    registerState(node, { kind, props, rootContainer });
    return node;
};
