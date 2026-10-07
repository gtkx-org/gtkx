import { Bytes, Variant as GeneratedVariant, VariantType } from "../glib.js";

/** JavaScript type every GVariant basic type code unpacks to, with a nested variant held as `Nested`. */
type BasicValueMap<Nested> = {
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
    v: Nested;
};

/** Single-character code of one of the GVariant basic types in {@link BasicValueMap}. */
type BasicCode = keyof BasicValueMap<unknown>;
/** JavaScript type a byte array (`ay`) unpacks to. */
type VariantByteArray = ReturnType<Bytes["unrefToArray"]>;
/** Values a byte array (`ay`) packs from. */
type ByteArrayInput = string | Uint8Array | number[];

/**
 * Parses the element type of an array, yielding the array type it produces and the rest of the string. An array of
 * bytes yields the byte array type instead of `number[]`.
 */
type ParseArray<S extends string, Bytes, Nested> = S extends `y${infer Rest}`
    ? [Bytes, Rest]
    : Parse<S, Bytes, Nested> extends [infer V, infer R extends string]
        ? [V[], R]
        : never;

/** Parses the element type of a maybe, yielding the nullable type it produces and the rest of the string. */
type ParseMaybe<S extends string, Bytes, Nested> =
    Parse<S, Bytes, Nested> extends [infer V, infer R extends string] ? [V | null, R] : never;

/** Collects tuple member types into `Acc` up to the closing parenthesis, yielding them and the rest of the string. */
type ParseTuple<S extends string, Bytes, Nested, Acc extends unknown[]> = S extends `)${infer Rest}`
    ? [Acc, Rest]
    : [Parse<S, Bytes, Nested>] extends [never]
            ? never
            : Parse<S, Bytes, Nested> extends [infer V, infer R extends string]
                ? ParseTuple<R, Bytes, Nested, [...Acc, V]>
                : never;

/** Types a dictionary entry key can hold. */
type DictKey = string | number | bigint | boolean;

/** Parses the key and value types of a dictionary entry, yielding them and the rest of the string after its brace. */
type ParsePair<S extends string, Bytes, Nested> =
    Parse<S, Bytes, Nested> extends [infer K, infer R1 extends string]
        ? Parse<R1, Bytes, Nested> extends [infer V, infer R2 extends string]
            ? R2 extends `}${infer R3}`
                ? [K] extends [DictKey]
                        ? [K, V, R3]
                        : never
                : never
            : never
        : never;

/** Parses a dictionary entry into a record, plus the rest of the string. */
type ParseDict<S extends string, Bytes, Nested> =
    ParsePair<S, Bytes, Nested> extends [unknown, infer V, infer R extends string]
        ? [Record<string, V>, R]
        : never;

/** Parses a standalone dictionary entry into a key and value pair, yielding it and the rest of the string. */
type ParseEntry<S extends string, Bytes, Nested> =
    ParsePair<S, Bytes, Nested> extends [infer K, infer V, infer R extends string] ? [[K, V], R] : never;

/** Parses what follows an `a` as a dictionary when it opens an entry, and as a plain array otherwise. */
type ParseArrayOrDict<S extends string, Bytes, Nested> = S extends `{${infer Rest}`
    ? ParseDict<Rest, Bytes, Nested>
    : ParseArray<S, Bytes, Nested>;

/**
 * Parses the type at the head of `S`, yielding the JavaScript type it unpacks to and the rest of the string, or
 * `never` when the string is malformed.
 */
type Parse<S extends string, Bytes, Nested> = S extends `a${infer Rest}`
    ? ParseArrayOrDict<Rest, Bytes, Nested>
    : S extends `m${infer Rest}`
        ? ParseMaybe<Rest, Bytes, Nested>
        : S extends `(${infer Rest}`
            ? ParseTuple<Rest, Bytes, Nested, []>
            : S extends `{${infer Rest}`
                ? ParseEntry<Rest, Bytes, Nested>
                : S extends `${infer C}${infer Rest}`
                    ? C extends BasicCode
                        ? [BasicValueMap<Nested>[C], Rest]
                        : never
                    : never;

/** JavaScript type a type string `S` describes, or `unknown` when `S` is not one complete type. */
type ParsedValue<S extends string, Bytes, Nested> = [Parse<S, Bytes, Nested>] extends [never]
    ? unknown
    : Parse<S, Bytes, Nested> extends [infer V, ""]
        ? V
        : unknown;

/**
 * JavaScript type a variant of type string `S` unpacks to, or `unknown` when `S` is not one complete type. A byte
 * array (`ay`) unpacks to {@link VariantByteArray}, dictionaries to records, and a nested variant (`v`) to the
 * `Variant` itself. Signed and unsigned 64-bit integers unpack as exact `bigint` values.
 */
type VariantValue<S extends string> = ParsedValue<S, VariantByteArray, Variant>;

type InputValue<Value> = Value extends GeneratedVariant ? Value
    : Value extends Uint8Array ? ByteArrayInput
        : Value extends bigint ? bigint | number
            : Value extends object ? { [Key in keyof Value]: InputValue<Value[Key]> }
                : Value;

/**
 * Values accepted by the variant constructor for type string `S`, or `unknown` for a dynamic signature.
 * Byte arrays accept strings, `Uint8Array`, or byte arrays; 64-bit integers accept `bigint` or safe integer numbers.
 */
type VariantInput<S extends string> = InputValue<VariantValue<S>>;
/**
 * JavaScript type a variant of type string `S` unpacks to when every nested variant is unwrapped as well, so a `v`
 * reads as `unknown`.
 */
type RecursiveVariantValue<S extends string> = ParsedValue<S, VariantByteArray, unknown>;

/** Shallowly unpacked values, retaining variants for container children. */
type ShallowVariantValue<S extends string> = unknown extends VariantValue<S> ? unknown
    : S extends "ay" ? VariantByteArray
        : S extends `a{${string}}` ? Record<string, Variant>
            : S extends `a${string}` ? Variant[]
                : S extends `m${string}` ? Variant | null
                    : S extends `(${string})` | `{${string}}` ?
                            VariantValue<S> extends infer Tuple extends unknown[] ? { [Key in keyof Tuple]: Variant }
                                : unknown
                        : VariantValue<S>;

/**
 * A variant with unpacked types inferred from its constructor signature. An explicit method type argument
 * describes the expected signature for variants returned by native functions; it does not validate the value.
 */
interface Variant<S extends string = string> extends GeneratedVariant {
    /** Unpacks the outer container, retaining its children as variants. Byte arrays unpack to `Uint8Array`. */
    unpack<Type extends string = S>(): ShallowVariantValue<Type>;
    /** Unpacks containers recursively, preserving variants held inside `v` values. Dictionaries become objects. */
    deepUnpack<Type extends string = S>(): VariantValue<Type>;
    /** GJS compatibility alias for {@link deepUnpack}. */
    deep_unpack<Type extends string = S>(): VariantValue<Type>;
    /** Unpacks containers and every nested variant. Dictionaries become objects. */
    recursiveUnpack<Type extends string = S>(): RecursiveVariantValue<Type>;
}

type VariantStatics = Omit<typeof GeneratedVariant, "new"> & {
    /** Packs a value using its GVariant type signature, like the constructor. */
    new: <S extends string>(typeString: S, value: VariantInput<S>) => Variant<S>;
};

/** The native variant class with GJS-compatible construction and its existing native factory methods. */
type VariantConstructor = VariantStatics & {
    /** Packs a value using its GVariant type signature. Signed and unsigned 64-bit values unpack as `bigint`. */
    new<S extends string>(typeString: S, value: VariantInput<S>): Variant<S>;
};

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
const BYTE_ARRAY_TYPE_STRING = "ay";

const unpackBasic: Record<BasicCode, (variant: Variant) => unknown> = {
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

const packBasic: Record<BasicCode, (value: unknown) => Variant> = {
    b: (value) => Variant.newBoolean(value as boolean),
    y: (value) => Variant.newByte(value as number),
    n: (value) => Variant.newInt16(value as number),
    q: (value) => Variant.newUint16(value as number),
    i: (value) => Variant.newInt32(value as number),
    u: (value) => Variant.newUint32(value as number),
    h: (value) => Variant.newHandle(value as number),
    d: (value) => Variant.newDouble(value as number),
    x: (value) => Variant.newInt64(value as bigint),
    t: (value) => Variant.newUint64(value as bigint),
    s: (value) => Variant.newString(value as string),
    o: packObjectPath,
    g: packSignature,
    v: (value) => Variant.newVariant(value as Variant),
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

const isByteArray = (node: VariantTypeNode): boolean =>
    node.kind === "array" && node.element.kind === "basic" && node.element.code === "y";

type UnpackDepth = "shallow" | "deep" | "recursive";

const unpackChildren = <Value>(variant: Variant, unpackChild: (child: Variant) => Value): Value[] => {
    const children: Value[] = [];
    const count = variant.nChildren();

    for (let index = 0; index < count; index += 1) {
        children.push(unpackChild(variant.getChildValue(index)));
    }

    return children;
};

const unpackPair = (
    key: VariantTypeNode,
    value: VariantTypeNode,
    entry: Variant,
    depth: UnpackDepth,
): [unknown, unknown] => [
    unpackChild(key, entry.getChildValue(0), depth),
    unpackChild(value, entry.getChildValue(1), depth),
];

const unpackDict = (
    node: { key: VariantTypeNode; value: VariantTypeNode },
    variant: Variant,
    depth: UnpackDepth,
): Record<string, unknown> => {
    const entries = unpackChildren(variant, (entry): [string, unknown] => [
        String(unpackNode(node.key, entry.getChildValue(0), depth)),
        unpackChild(node.value, entry.getChildValue(1), depth),
    ]);

    return Object.fromEntries(entries);
};

const unpackMaybe = (element: VariantTypeNode, variant: Variant, depth: UnpackDepth): unknown => {
    const child = variant.getMaybe();

    return child === null ? null : unpackChild(element, child, depth);
};

const unpackNested = (variant: Variant, depth: UnpackDepth): unknown => {
    const held = variant.getVariant();

    return depth === "recursive" ? unpackNode(parseVariantType(held.getTypeString()), held, depth) : held;
};

const unpackChild = (node: VariantTypeNode, variant: Variant, depth: UnpackDepth): unknown =>
    depth === "shallow" ? variant : unpackNode(node, variant, depth);

const unpackNode = (node: VariantTypeNode, variant: Variant, depth: UnpackDepth): unknown => {
    switch (node.kind) {
        case "basic": {
            return node.code === "v" ? unpackNested(variant, depth) : unpackBasic[node.code](variant);
        }
        case "array": {
            return isByteArray(node)
                ? variant.getDataAsBytes().unrefToArray()
                : unpackChildren(variant, (child) => unpackChild(node.element, child, depth));
        }
        case "dict": {
            return unpackDict(node, variant, depth);
        }
        case "entry": {
            return unpackPair(node.key, node.value, variant, depth);
        }
        case "tuple": {
            return node.items.map((item, index) => unpackChild(item, variant.getChildValue(index), depth));
        }
        case "maybe": {
            return unpackMaybe(node.element, variant, depth);
        }
    }
};

const packValidatedString = (
    value: unknown,
    isValid: (value: string) => boolean,
    description: string,
    construct: (value: string) => Variant,
): Variant => {
    if (typeof value !== "string" || !isValid(value)) {
        throw new Error(`"${String(value)}" is not a valid GVariant ${description}`);
    }

    return construct(value);
};

function packObjectPath(value: unknown): Variant {
    return packValidatedString(
        value,
        (path) => Variant.isObjectPath(path),
        "object path",
        (path) => Variant.newObjectPath(path),
    );
}

function packSignature(value: unknown): Variant {
    return packValidatedString(
        value,
        (signature) => Variant.isSignature(signature),
        "type signature",
        (signature) => Variant.newSignature(signature),
    );
}

const packEntry = (
    key: VariantTypeNode,
    value: VariantTypeNode,
    pair: [unknown, unknown],
): Variant => Variant.newDictEntry(packNode(key, pair[0]), packNode(value, pair[1]));

const dictEntries = (value: unknown): [string, unknown][] => {
    if (value === null || typeof value !== "object") {
        throw new TypeError("Variant dictionaries require a plain object");
    }

    const prototype: unknown = Object.getPrototypeOf(value);

    if (prototype !== null && prototype !== Object.prototype) {
        throw new TypeError("Variant dictionaries require a plain object");
    }

    return Object.entries(value);
};

const dictionaryKey = (node: VariantTypeNode, key: string): unknown => {
    if (node.kind !== "basic" || isStringKeyed(node)) {
        return key;
    }

    if (node.code === "x" || node.code === "t") {
        return BigInt(key);
    }

    if (node.code === "b") {
        if (key !== "true" && key !== "false") {
            throw new TypeError("Boolean dictionary keys must be true or false");
        }

        return key === "true";
    }

    return Number(key);
};

const packDict = (
    node: { entryTypeString: string; key: VariantTypeNode; value: VariantTypeNode },
    value: unknown,
): Variant =>
    Variant.newArray(
        VariantType.new(node.entryTypeString),
        dictEntries(value).map(([key, entry]) =>
            packEntry(
                node.key,
                node.value,
                [dictionaryKey(node.key, key), entry],
            )),
    );

const packMaybe = (
    node: { elementTypeString: string; element: VariantTypeNode },
    value: unknown,
): Variant =>
    Variant.newMaybe(
        VariantType.new(node.elementTypeString),
        value === null ? null : packNode(node.element, value),
    );

const packByteArray = (value: unknown): Variant => {
    if (typeof value === "string") {
        value = new TextEncoder().encode(`${value}\0`);
    }

    if (!(value instanceof Uint8Array) && !Array.isArray(value)) {
        throw new TypeError("Expected a string, Uint8Array, or array of byte values for a byte array (ay)");
    }

    return Variant.newFromBytes(
        VariantType.new(BYTE_ARRAY_TYPE_STRING),
        Bytes.new(value),
        true,
    );
};

const packNode = (node: VariantTypeNode, value: unknown): Variant => {
    switch (node.kind) {
        case "basic": {
            if ((node.code === "x" || node.code === "t") && typeof value === "number") {
                if (!Number.isSafeInteger(value)) {
                    throw new RangeError("64-bit variant numbers must be safe integers; use bigint for larger values");
                }

                value = BigInt(value);
            }

            return packBasic[node.code](value);
        }
        case "array": {
            if (isByteArray(node)) {
                return packByteArray(value);
            }

            if (!Array.isArray(value)) {
                throw new TypeError("Expected an array of values for a variant array");
            }

            return Variant.newArray(
                VariantType.new(node.elementTypeString),
                value.map((item: unknown) => packNode(node.element, item)),
            );
        }
        case "dict": {
            return packDict(node, value);
        }
        case "entry": {
            if (!Array.isArray(value) || value.length !== 2) {
                throw new TypeError("Expected two values for a variant dictionary entry");
            }

            return packEntry(node.key, node.value, [value[0], value[1]]);
        }
        case "tuple": {
            if (!Array.isArray(value) || value.length !== node.items.length) {
                throw new TypeError(`Expected ${node.items.length} values for a variant tuple`);
            }

            const values = value;

            return Variant.newTuple(
                node.items.map((item, index) => packNode(item, values[index])),
            );
        }
        case "maybe": {
            return packMaybe(node, value);
        }
    }
};

const createVariant = <S extends string>(typeString: S, value: VariantInput<S>): Variant<S> =>
    packNode(parseVariantType(typeString), value);

/**
 * Packs JavaScript values using GJS-compatible construction. Strings for `ay` become NUL-terminated UTF-8;
 * dictionaries use plain objects. Unlike GJS, 64-bit integers unpack as exact `bigint` values.
 */
const Variant: VariantConstructor = /* @__PURE__ */ (() => new Proxy(GeneratedVariant, {
    get(target, property, receiver): unknown {
        if (property === "new") {
            return createVariant;
        }

        const value: unknown = Reflect.get(target, property, receiver);

        return value;
    },
    construct(_target, args: unknown[]): Variant {
        const [typeString, value] = args;

        if (typeof typeString !== "string") {
            throw new TypeError("A variant constructor requires a GVariant type string");
        }

        return createVariant(typeString, value);
    },
}) as typeof GeneratedVariant & VariantConstructor)();

declare module "../glib.js" {
    interface Variant {
        /**
         * Unpacks the outer container, retaining child variants. Byte arrays unpack to `Uint8Array`.
         * An optional type argument describes the expected signature without validating it.
         */
        unpack<S extends string = string>(): ShallowVariantValue<S>;
        /**
         * Unpacks containers recursively, retaining variants inside `v` values. Dictionaries become objects.
         * An optional type argument describes the expected signature without validating it.
         */
        deepUnpack<S extends string = string>(): VariantValue<S>;
        /** GJS compatibility alias for {@link deepUnpack}. */
        deep_unpack<S extends string = string>(): VariantValue<S>;
        /**
         * Unpacks containers and nested variants recursively. Dictionaries become objects.
         * An optional type argument describes the expected signature without validating it.
         */
        recursiveUnpack<S extends string = string>(): RecursiveVariantValue<S>;
    }
}

GeneratedVariant.prototype.unpack = function <S extends string = string>(): ShallowVariantValue<S> {
    return unpackNode(parseVariantType(this.getTypeString()), this, "shallow") as ShallowVariantValue<S>;
};

const deepUnpack = function <S extends string = string>(this: GeneratedVariant): VariantValue<S> {
    return unpackNode(parseVariantType(this.getTypeString()), this, "deep") as VariantValue<S>;
};

GeneratedVariant.prototype.deepUnpack = deepUnpack;
GeneratedVariant.prototype.deep_unpack = deepUnpack;

GeneratedVariant.prototype.recursiveUnpack = function <S extends string = string>(): RecursiveVariantValue<S> {
    return unpackNode(parseVariantType(this.getTypeString()), this, "recursive") as RecursiveVariantValue<S>;
};

export {
    type VariantByteArray,
    type RecursiveVariantValue,
    type ShallowVariantValue,
    Variant,
    type VariantConstructor,
    type VariantInput,
    type VariantValue,
};
