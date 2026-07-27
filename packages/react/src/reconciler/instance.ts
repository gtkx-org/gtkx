import type * as GObject from "@gtkx/gi/gobject";
import { getWrapperClass, TYPE_INVALID, typeFromName, typeIsA } from "@gtkx/runtime";
import { pickBy } from "@gtkx/utils";
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

type WidgetConstructor = new (props: Props) => GObject.Object;
type ContentType = { kind: ContentKind; type: bigint };

const CONTENT_TYPE_NAMES: { kind: ContentKind; name: string }[] = [
    { kind: "label", name: "GtkLabel" },
    { kind: "buffer", name: "GtkTextBuffer" },
    { kind: "tag", name: "GtkTextTag" },
    { kind: "anchor", name: "GtkTextChildAnchor" },
];

const getContentTypes = createContentTypeCache();

function createContentTypeCache(): () => ContentType[] {
    let cached: ContentType[] | null = null;

    return () => {
        cached ??= CONTENT_TYPE_NAMES.map((entry) => ({ kind: entry.kind, type: typeFromName(entry.name) }));

        return cached;
    };
}

const resolveContentKind = (type: bigint): ContentKind | null => {
    for (const entry of getContentTypes()) {
        if (entry.type !== TYPE_INVALID && typeIsA(type, entry.type)) {
            return entry.kind;
        }
    }

    return null;
};

const constructInput = (info: TypeInfo, props: Props): Props =>
    pickBy(
        props,
        (value, name) =>
            value !== undefined &&
            !info.deferred.has(name) &&
            (info.constructOnly.has(name) || info.construct.has(name)),
    );

const instantiate = (type: bigint, input: Props): GObject.Object => {
    const cls = getWrapperClass(type) as WidgetConstructor;

    return new cls(input);
};

const resolveElementNode = (typeName: string, props: Props, dispatch: Dispatch): ElementNode | LazyNode => {
    const info = typeInfoFor(typeName);

    if (info.lazy) {
        return createLazyNode(typeName, props, dispatch);
    }

    const type = typeFromName(typeName);
    const object = instantiate(type, constructInput(info, props));

    return createElementNode(typeName, object, dispatch, resolveContentKind(type));
};

export { resolveElementNode };
