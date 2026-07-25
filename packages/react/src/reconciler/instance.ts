import type * as GObject from "@gtkx/gi/gobject";
import { getWrapperClass, TYPE_INVALID, typeFromName, typeIsA } from "@gtkx/runtime";
import type { Props } from "./elements.js";
import { type TypeInfo, typeInfoOf } from "./metadata.js";
import {
    type ContentKind,
    createLazyNode,
    type Dispatch,
    type ElementNode,
    type LazyNode,
    makeElementNode,
} from "./node.js";

type WidgetConstructor = new (props: Props) => GObject.Object;

const CONTENT_TYPE_NAMES: { kind: ContentKind; name: string }[] = [
    { kind: "label", name: "GtkLabel" },
    { kind: "buffer", name: "GtkTextBuffer" },
    { kind: "tag", name: "GtkTextTag" },
    { kind: "anchor", name: "GtkTextChildAnchor" },
];

let contentTypes: { kind: ContentKind; type: bigint }[] | null = null;

const resolveContentKind = (type: bigint): ContentKind | null => {
    contentTypes ??= CONTENT_TYPE_NAMES.map((entry) => ({ kind: entry.kind, type: typeFromName(entry.name) }));
    for (const entry of contentTypes) {
        if (entry.type !== TYPE_INVALID && typeIsA(type, entry.type)) return entry.kind;
    }
    return null;
};

const constructInput = (info: TypeInfo, props: Props): Props => {
    const input: Props = {};
    for (const name in props) {
        if (info.deferred.has(name) || props[name] === undefined) continue;
        if (info.constructOnly.has(name) || info.construct.has(name)) input[name] = props[name];
    }
    return input;
};

const instantiate = (type: bigint, input: Props): GObject.Object => {
    const cls = getWrapperClass(type) as WidgetConstructor;
    return new cls(input);
};

export const createElementNode = (typeName: string, props: Props, dispatch: Dispatch): ElementNode | LazyNode => {
    const info = typeInfoOf(typeName);
    if (info.lazy) return createLazyNode(typeName, props, dispatch);
    const type = typeFromName(typeName);
    const object = instantiate(type, constructInput(info, props));
    return makeElementNode(typeName, object, dispatch, resolveContentKind(type));
};
