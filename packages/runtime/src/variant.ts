import * as GLib from "@gtkx/gi/glib";

/** JavaScript type every GVariant basic type code unpacks to. */
type BasicValueMap = {
    /** Boolean, held as a single byte reading 0 or 1. */
    b: boolean;
    /** Unsigned byte. */
    y: number;
    /** Signed 16-bit integer. */
    n: number;
    /** Unsigned 16-bit integer. */
    q: number;
    /** Signed 32-bit integer. */
    i: number;
    /** Unsigned 32-bit integer. */
    u: number;
    /** Index into the file descriptor list a message carries. */
    h: number;
    /** Double precision floating point number. */
    d: number;
    /** Signed 64-bit integer. */
    x: bigint;
    /** Unsigned 64-bit integer. */
    t: bigint;
    /** UTF-8 string, under no further constraint on what it holds. */
    s: string;
    /** D-Bus object path. */
    o: string;
    /** GVariant type signature. */
    g: string;
    /** Boxed variant holding a value of any type. */
    v: GLib.Variant;
};

/** Single-character code of one of the GVariant basic types in {@link BasicValueMap}. */
type BasicCode = keyof BasicValueMap;
/** Parses the element type of an array, yielding the array type it produces and the rest of the string. */
type ParseArray<S extends string> = Parse<S> extends [infer V, infer R extends string] ? [V[], R] : never;
/** Parses the element type of a maybe, yielding the nullable type it produces and the rest of the string. */
type ParseMaybe<S extends string> = Parse<S> extends [infer V, infer R extends string] ? [V | null, R] : never;

/** Collects tuple member types into `Acc` up to the closing parenthesis, yielding them and the rest of the string. */
type ParseTuple<S extends string, Acc extends unknown[]> = S extends `)${infer Rest}`
    ? [Acc, Rest]
    : [Parse<S>] extends [never]
            ? never
            : Parse<S> extends [infer V, infer R extends string]
                ? ParseTuple<R, [...Acc, V]>
                : never;

/** Types a dictionary entry key can hold. */
type DictKey = string | number | bigint | boolean;

/** Parses the key and value types of a dictionary entry, yielding them and the rest of the string after its brace. */
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

/**
 * Parses a dictionary entry into the collection an array of those entries unpacks to, a record for string keys and a
 * `Map` otherwise, plus the rest of the string.
 */
type ParseDict<S extends string> =
    ParsePair<S> extends [infer K, infer V, infer R extends string]
        ? [[K] extends [string] ? Record<string, V> : Map<K, V>, R]
        : never;

/** Parses a standalone dictionary entry into a key and value pair, yielding it and the rest of the string. */
type ParseEntry<S extends string> =
    ParsePair<S> extends [infer K, infer V, infer R extends string] ? [[K, V], R] : never;

/** Parses what follows an `a` as a dictionary when it opens an entry, and as a plain array otherwise. */
type ParseArrayOrDict<S extends string> = S extends `{${infer Rest}` ? ParseDict<Rest> : ParseArray<S>;

/**
 * Parses the type at the head of `S`, yielding the JavaScript type it unpacks to and the rest of the string, or
 * `never` when the string is malformed.
 */
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

/** JavaScript type a variant of type string `S` unpacks to, or `unknown` when `S` is not one complete type. */
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
    unpackNode(key, entry.getChildValue(0)),
    unpackNode(value, entry.getChildValue(1)),
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

    return child === null ? null : unpackNode(element, child);
};

const unpackNode = (node: VariantTypeNode, variant: GLib.Variant): unknown => {
    switch (node.kind) {
        case "basic": {
            return unpackBasic[node.code](variant);
        }
        case "array": {
            return unpackChildren(variant, (child) => unpackNode(node.element, child));
        }
        case "dict": {
            return unpackDict(node, variant);
        }
        case "entry": {
            return unpackPair(node.key, node.value, variant);
        }
        case "tuple": {
            return node.items.map((item, index) => unpackNode(item, variant.getChildValue(index)));
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
    GLib.Variant.newDictEntry(packNode(key, pair[0]), packNode(value, pair[1]));

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
        value === null ? null : packNode(node.element, value),
    );

const packNode = (node: VariantTypeNode, value: unknown): GLib.Variant => {
    switch (node.kind) {
        case "basic": {
            return packBasic[node.code](value);
        }
        case "array": {
            return GLib.Variant.newArray(
                GLib.VariantType.new(node.elementTypeString),
                (value as unknown[]).map((item) => packNode(node.element, item)),
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
                node.items.map((item, index) => packNode(item, (value as unknown[])[index])),
            );
        }
        case "maybe": {
            return packMaybe(node, value);
        }
    }
};

/**
 * Packs a JavaScript value into the `GLib.Variant` a GVariant type string describes, building the
 * nested arrays, dictionaries, tuples and maybes the type calls for. A type string given as a
 * literal also types `value`, so `"as"` takes an array of strings, `"a{sv}"` a record of variants,
 * `"(si)"` a string and a number pair, and a 64-bit type a `bigint`.
 * @param typeString GVariant type of the variant to build, such as `"a{sv}"`.
 * @param value Value to pack, shaped the way `typeString` describes.
 * @returns The packed variant.
 * @throws {Error} When the type string is not one complete GVariant type, or when a value packed as
 * an object path or a type signature is not a valid one.
 */
const toVariant = <S extends string>(typeString: S, value: VariantValue<S>): GLib.Variant =>
    packNode(parseVariantType(typeString), value);

/**
 * Unpacks a `GLib.Variant` into the JavaScript value a GVariant type string describes, the inverse
 * of {@link toVariant}. A dictionary keyed by strings unpacks to a record and one keyed by anything
 * else to a `Map`, an array to an array, a tuple to an array of its members, a maybe to its value or
 * `null`, and a nested variant to the `GLib.Variant` itself.
 * @param typeString GVariant type the variant holds, such as `"a{sv}"`.
 * @param variant Variant to read, which has to hold that type.
 * @returns The unpacked value, typed from `typeString` when it is given as a literal.
 * @throws {Error} When the type string is not one complete GVariant type.
 */
const fromVariant = <S extends string>(typeString: S, variant: GLib.Variant): VariantValue<S> =>
    unpackNode(parseVariantType(typeString), variant) as VariantValue<S>;

export { fromVariant, toVariant, type VariantValue };
