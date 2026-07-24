import type * as GObject from "@gtkx/gi/gobject";
import { getWrapperClass, TYPE_INVALID, typeFromName, typeIsA } from "@gtkx/runtime";
import { ELEMENT_KIND, type Props } from "./kinds.js";
import { type TypeInfo, typeInfoOf } from "./metadata.js";
import type { ContentKind, ElementNode } from "./node.js";

type WidgetConstructor = new (props: Props) => GObject.Object;

const notRegistered = (typeName: string): Error =>
    new Error(
        `${typeName} is not registered. Import its @gtkx/jsx namespace module (e.g. \`import "@gtkx/jsx/adw"\`) before use.`,
    );

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
        if (info.lazyProps.has(name) || props[name] === undefined) continue;
        if (info.constructOnly.has(name) || info.construct.has(name)) input[name] = props[name];
    }
    return input;
};

const instantiate = (typeName: string, input: Props): GObject.Object => {
    const type = typeFromName(typeName);
    if (type === TYPE_INVALID) throw notRegistered(typeName);
    const cls = getWrapperClass(type) as WidgetConstructor;
    return new cls(input);
};

export const createObject = (typeName: string): GObject.Object => instantiate(typeName, {});

export const createElementNode = (typeName: string, props: Props): ElementNode => {
    const info = typeInfoOf(typeName);
    const object = instantiate(typeName, constructInput(info, props));
    const contentKind = resolveContentKind(typeFromName(typeName));
    return {
        kind: ELEMENT_KIND,
        typeName,
        object,
        props: {},
        handlers: new Map(),
        placements: new Map(),
        objectSlots: new Set(),
        lazyApplied: new Map(),
        listApplied: new Map(),
        parent: null,
        content: contentKind === null ? null : [],
        contentKind,
        bufferView: null,
    };
};
