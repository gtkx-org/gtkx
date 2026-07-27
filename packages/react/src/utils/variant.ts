import * as GLib from "@gtkx/gi/glib";

type BasicValueMap = {
    b: boolean;
    y: number;
    n: number;
    q: number;
    i: number;
    u: number;
    h: number;
    d: number;
    x: bigint;
    t: bigint;
    s: string;
    o: string;
    g: string;
    v: GLib.Variant;
};

type BasicCode = keyof BasicValueMap;
type ParseArray<S extends string> = Parse<S> extends [infer V, infer R extends string] ? [V[], R] : never;
type ParseMaybe<S extends string> = Parse<S> extends [infer V, infer R extends string] ? [V | null, R] : never;

type ParseTuple<S extends string, Acc extends unknown[]> = S extends `)${infer Rest}`
    ? [Acc, Rest]
    : [Parse<S>] extends [never]
            ? never
            : Parse<S> extends [infer V, infer R extends string]
                ? ParseTuple<R, [...Acc, V]>
                : never;

type DictKey = string | number | bigint | boolean;

type ParsePair<S extends string> =
    Parse<S> extends [infer K, infer R1 extends string]
        ? Parse<R1> extends [infer V, infer R2 extends string]
            ? R2 extends `}${infer R3}`
                ? [K] extends [DictKey]
                        ? [K, V, R3]
                        : never
                : never
            : never
        : never;

type ParseDict<S extends string> =
    ParsePair<S> extends [infer K, infer V, infer R extends string]
        ? [[K] extends [string] ? Record<string, V> : Map<K, V>, R]
        : never;

type ParseEntry<S extends string> =
    ParsePair<S> extends [infer K, infer V, infer R extends string] ? [[K, V], R] : never;

type ParseArrayOrDict<S extends string> = S extends `{${infer Rest}` ? ParseDict<Rest> : ParseArray<S>;

type Parse<S extends string> = S extends `a${infer Rest}`
    ? ParseArrayOrDict<Rest>
    : S extends `m${infer Rest}`
        ? ParseMaybe<Rest>
        : S extends `(${infer Rest}`
            ? ParseTuple<Rest, []>
            : S extends `{${infer Rest}`
                ? ParseEntry<Rest>
                : S extends `${infer C}${infer Rest}`
                    ? C extends BasicCode
                        ? [BasicValueMap[C], Rest]
                        : never
                    : never;

type VariantValue<S extends string> = [Parse<S>] extends [never]
    ? unknown
    : Parse<S> extends [infer V, ""]
        ? V
        : unknown;

type VariantTypeNode =
    | { kind: "basic"; code: BasicCode } |
    { kind: "array"; elementTypeString: string; element: VariantTypeNode } |
    { kind: "dict"; entryTypeString: string; key: VariantTypeNode; value: VariantTypeNode } |
    { kind: "entry"; key: VariantTypeNode; value: VariantTypeNode } |
    { kind: "tuple"; items: VariantTypeNode[] } |
    { kind: "maybe"; elementTypeString: string; element: VariantTypeNode };

const BASIC_CODES = "bynqiuxthdsogv";
const STRING_KEY_CODES: Set<string> = new Set(["s", "o", "g"]);

const CONTAINER_PARSERS: Record<string, (source: string, start: number) => [VariantTypeNode, number]> = {
    a: parseArrayNode,
    m: parseMaybeNode,
    "(": parseTupleNode,
    "{": parseEntryNode,
};

const parsedTypes: Map<string, VariantTypeNode> = new Map();

const unpackBasic: Record<BasicCode, (variant: GLib.Variant) => unknown> = {
    b: (variant) => variant.getBoolean(),
    y: (variant) => variant.getByte(),
    n: (variant) => variant.getInt16(),
    q: (variant) => variant.getUint16(),
    i: (variant) => variant.getInt32(),
    u: (variant) => variant.getUint32(),
    h: (variant) => variant.getHandle(),
    d: (variant) => variant.getDouble(),
    x: (variant) => variant.getInt64(),
    t: (variant) => variant.getUint64(),
    s: (variant) => variant.getString()[0],
    o: (variant) => variant.getString()[0],
    g: (variant) => variant.getString()[0],
    v: (variant) => variant.getVariant(),
};

const packBasic: Record<BasicCode, (value: unknown) => GLib.Variant> = {
    b: (value) => GLib.Variant.newBoolean(value as boolean),
    y: (value) => GLib.Variant.newByte(value as number),
    n: (value) => GLib.Variant.newInt16(value as number),
    q: (value) => GLib.Variant.newUint16(value as number),
    i: (value) => GLib.Variant.newInt32(value as number),
    u: (value) => GLib.Variant.newUint32(value as number),
    h: (value) => GLib.Variant.newHandle(value as number),
    d: (value) => GLib.Variant.newDouble(value as number),
    x: (value) => GLib.Variant.newInt64(value as bigint),
    t: (value) => GLib.Variant.newUint64(value as bigint),
    s: (value) => GLib.Variant.newString(value as string),
    o: packObjectPath,
    g: packSignature,
    v: (value) => GLib.Variant.newVariant(value as GLib.Variant),
};

const isBasicCode = (code: string): code is BasicCode => BASIC_CODES.includes(code);
const isStringKeyed = (key: VariantTypeNode): boolean => key.kind === "basic" && STRING_KEY_CODES.has(key.code);
const invalidType = (source: string): Error => new Error(`Invalid GVariant type string "${source}"`);

const parsePair = (source: string, start: number): [VariantTypeNode, VariantTypeNode, number] => {
    const [key, keyEnd] = parseNode(source, start);

    if (key.kind !== "basic" || key.code === "v") {
        throw invalidType(source);
    }

    const [value, valueEnd] = parseNode(source, keyEnd);

    if (source[valueEnd] !== "}") {
        throw invalidType(source);
    }

    return [key, value, valueEnd + 1];
};

function parseArrayNode(source: string, start: number): [VariantTypeNode, number] {
    if (source[start] === "{") {
        const [key, value, end] = parsePair(source, start + 1);

        return [{ kind: "dict", entryTypeString: source.slice(start, end), key, value }, end];
    }

    const [element, end] = parseNode(source, start);

    return [{ kind: "array", elementTypeString: source.slice(start, end), element }, end];
}

function parseMaybeNode(source: string, start: number): [VariantTypeNode, number] {
    const [element, end] = parseNode(source, start);

    return [{ kind: "maybe", elementTypeString: source.slice(start, end), element }, end];
}

function parseTupleNode(source: string, start: number): [VariantTypeNode, number] {
    const items: VariantTypeNode[] = [];
    let position = start;

    while (source[position] !== ")") {
        if (position >= source.length) {
            throw invalidType(source);
        }

        const [item, end] = parseNode(source, position);
        items.push(item);
        position = end;
    }

    return [{ kind: "tuple", items }, position + 1];
}

function parseEntryNode(source: string, start: number): [VariantTypeNode, number] {
    const [key, value, end] = parsePair(source, start);

    return [{ kind: "entry", key, value }, end];
}

const parseNode = (source: string, start: number): [VariantTypeNode, number] => {
    const code = source[start];

    if (code === undefined) {
        throw invalidType(source);
    }

    const container = CONTAINER_PARSERS[code];

    if (container !== undefined) {
        return container(source, start + 1);
    }

    if (isBasicCode(code)) {
        return [{ kind: "basic", code }, start + 1];
    }

    throw invalidType(source);
};

const parseVariantType = (typeString: string): VariantTypeNode => {
    const cached = parsedTypes.get(typeString);

    if (cached !== undefined) {
        return cached;
    }

    const [node, end] = parseNode(typeString, 0);

    if (end !== typeString.length) {
        throw invalidType(typeString);
    }

    parsedTypes.set(typeString, node);

    return node;
};

const unpackChildren = (variant: GLib.Variant, unpackChild: (child: GLib.Variant) => unknown): unknown[] => {
    const children: unknown[] = [];
    const count = variant.nChildren();

    for (let index = 0; index < count; index += 1) {
        children.push(unpackChild(variant.getChildValue(index)));
    }

    return children;
};

const unpackPair = (key: VariantTypeNode, value: VariantTypeNode, entry: GLib.Variant): [unknown, unknown] => [
    unpackVariant(key, entry.getChildValue(0)),
    unpackVariant(value, entry.getChildValue(1)),
];

const unpackDict = (
    node: { key: VariantTypeNode; value: VariantTypeNode },
    variant: GLib.Variant,
): Record<string, unknown> | Map<unknown, unknown> => {
    const entries = unpackChildren(variant, (entry) => unpackPair(node.key, node.value, entry)) as [unknown, unknown][];

    if (!isStringKeyed(node.key)) {
        return new Map(entries);
    }

    const stringEntries: [string, unknown][] = entries.map(([key, value]) => [key as string, value]);

    return Object.fromEntries(stringEntries);
};

const unpackMaybe = (element: VariantTypeNode, variant: GLib.Variant): unknown => {
    const child = variant.getMaybe();

    return child === null ? null : unpackVariant(element, child);
};

const unpackVariant = (node: VariantTypeNode, variant: GLib.Variant): unknown => {
    switch (node.kind) {
        case "basic": {
            return unpackBasic[node.code](variant);
        }
        case "array": {
            return unpackChildren(variant, (child) => unpackVariant(node.element, child));
        }
        case "dict": {
            return unpackDict(node, variant);
        }
        case "entry": {
            return unpackPair(node.key, node.value, variant);
        }
        case "tuple": {
            return node.items.map((item, index) => unpackVariant(item, variant.getChildValue(index)));
        }
        case "maybe": {
            return unpackMaybe(node.element, variant);
        }
    }
};

const packValidatedString = (
    value: unknown,
    isValid: (value: string) => boolean,
    description: string,
    construct: (value: string) => GLib.Variant,
): GLib.Variant => {
    if (typeof value !== "string" || !isValid(value)) {
        throw new Error(`"${String(value)}" is not a valid GVariant ${description}`);
    }

    return construct(value);
};

function packObjectPath(value: unknown): GLib.Variant {
    return packValidatedString(
        value,
        (path) => GLib.Variant.isObjectPath(path),
        "object path",
        (path) => GLib.Variant.newObjectPath(path),
    );
}

function packSignature(value: unknown): GLib.Variant {
    return packValidatedString(
        value,
        (signature) => GLib.Variant.isSignature(signature),
        "type signature",
        (signature) => GLib.Variant.newSignature(signature),
    );
}

const packEntry = (key: VariantTypeNode, value: VariantTypeNode, pair: [unknown, unknown]): GLib.Variant =>
    GLib.Variant.newDictEntry(packVariant(key, pair[0]), packVariant(value, pair[1]));

const dictEntries = (value: unknown): [unknown, unknown][] =>
    value instanceof Map ? [...value] : Object.entries(value as Record<string, unknown>);

const packDict = (
    node: { entryTypeString: string; key: VariantTypeNode; value: VariantTypeNode },
    value: unknown,
): GLib.Variant =>
    GLib.Variant.newArray(
        GLib.VariantType.new(node.entryTypeString),
        dictEntries(value).map((pair) => packEntry(node.key, node.value, pair)),
    );

const packMaybe = (node: { elementTypeString: string; element: VariantTypeNode }, value: unknown): GLib.Variant =>
    GLib.Variant.newMaybe(
        GLib.VariantType.new(node.elementTypeString),
        value === null ? null : packVariant(node.element, value),
    );

const packVariant = (node: VariantTypeNode, value: unknown): GLib.Variant => {
    switch (node.kind) {
        case "basic": {
            return packBasic[node.code](value);
        }
        case "array": {
            return GLib.Variant.newArray(
                GLib.VariantType.new(node.elementTypeString),
                (value as unknown[]).map((item) => packVariant(node.element, item)),
            );
        }
        case "dict": {
            return packDict(node, value);
        }
        case "entry": {
            return packEntry(node.key, node.value, value as [unknown, unknown]);
        }
        case "tuple": {
            return GLib.Variant.newTuple(
                node.items.map((item, index) => packVariant(item, (value as unknown[])[index])),
            );
        }
        case "maybe": {
            return packMaybe(node, value);
        }
    }
};

export { parseVariantType, unpackVariant, packVariant, type VariantValue, type VariantTypeNode };
