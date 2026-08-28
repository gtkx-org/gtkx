import type * as GObject from "@gtkx/gi/gobject";
import { TYPE_INVALID, typeFromName, typeIsA } from "@gtkx/runtime";
import { getExactWrapperClass } from "@gtkx/runtime/internal";
import { getOrInsert, pickBy } from "@gtkx/utils";
import type { Props } from "./registry.js";
import { type TypeInfo, typeInfoFor } from "./metadata.js";
import {
    type ContentKind,
    createElementNode,
    createLazyNode,
    type Dispatch,
    type ElementNode,
    type LazyNode,
} from "./node.js";
import { ELEMENTS } from "./registry.js";

type WidgetConstructor = new (props: Props) => GObject.Object;
type ContentType = { kind: ContentKind; type: bigint };

const CONTENT_TYPE_NAMES: { kind: ContentKind; name: string }[] = [
    { kind: "label", name: "GtkLabel" },
    { kind: "buffer", name: "GtkTextBuffer" },
    { kind: "tag", name: "GtkTextTag" },
    { kind: "anchor", name: "GtkTextChildAnchor" },
];

const getContentTypes = createContentTypeCache();
const contentKinds: Map<bigint, ContentKind | null> = new Map();

function createContentTypeCache(): () => ContentType[] {
    let cached: ContentType[] | null = null;

    return () => {
        cached ??= CONTENT_TYPE_NAMES.map((entry) => ({ kind: entry.kind, type: typeFromName(entry.name) }));

        return cached;
    };
}

const findContentKind = (type: bigint): ContentKind | null => {
    for (const entry of getContentTypes()) {
        if (entry.type !== TYPE_INVALID && typeIsA(type, entry.type)) {
            return entry.kind;
        }
    }

    return null;
};

const contentKindFor = (type: bigint): ContentKind | null => getOrInsert(contentKinds, type, findContentKind);

const constructInput = (info: TypeInfo, props: Props): Props =>
    pickBy(
        props,
        (value, name) =>
            value !== undefined &&
            !info.deferred.has(name) &&
            (info.constructOnly.has(name) || info.construct.has(name)),
    );

const instantiate = (typeName: string, type: bigint, input: Props): GObject.Object => {
    const cls = getExactWrapperClass(type, typeName) as WidgetConstructor;

    return new cls(input);
};

const createObject = (typeName: string, type: bigint, input: Props): GObject.Object => {
    const create = ELEMENTS[typeName]?.behaviors?.find((behavior) => behavior.create !== undefined)?.create;

    return create === undefined ? instantiate(typeName, type, input) : create(input);
};

const resolveElementNode = (typeName: string, props: Props, dispatch: Dispatch): ElementNode | LazyNode => {
    const info = typeInfoFor(typeName);

    if (info.isLazy) {
        return createLazyNode(typeName, props, dispatch);
    }

    const type = typeFromName(typeName);
    const object = createObject(typeName, type, constructInput(info, props));

    return createElementNode(typeName, object, dispatch, contentKindFor(type));
};

export { resolveElementNode };
