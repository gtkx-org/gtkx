import type { RawNode } from "./parse.js";
import type { PrimitiveCategory } from "./primitives.js";

type TypeId = { nsId: number; id: number };
type ListFlavor = (typeof LIST_FLAVOR_BY_NAME)[keyof typeof LIST_FLAVOR_BY_NAME];
type PrimitiveType = { kind: "primitive"; category: PrimitiveCategory };
type VarargsType = { kind: "varargs" };

type CArrayType = {
    kind: "carray";
    element: TypeId;
    elementCType: string | undefined;
    lengthParameterIndex: number | undefined;
    fixedSize: number | undefined;
    zeroTerminated: boolean;
};

type ListType = {
    kind: "list";
    flavor: ListFlavor;
    element: TypeId;
};

type HashTableType = {
    kind: "hashtable";
    key: TypeId;
    value: TypeId;
};

type StructuralType = PrimitiveType | VarargsType | CArrayType | ListType | HashTableType;

type ParseContext = {
    nsId: number;
    findType(name: string): TypeId;
    addPrimitive(category: PrimitiveCategory): TypeId;
    addVarargs(): TypeId;
    addContainer(type: CArrayType | ListType | HashTableType): TypeId;
    addAnonymousCallback(node: RawNode): TypeId;
};

const LIST_FLAVOR_BY_NAME = {
    "GLib.List": "glist",
    "GLib.SList": "gslist",
    "GLib.PtrArray": "gptrarray",
    "GLib.Array": "garray",
    "GLib.ByteArray": "gbytearray",
} as const;

// An array with no length parameter, no fixed size and an explicit `zero-terminated="0"` carries no
// way to recover its length, so it is a bare pointer rather than something that can be walked.
const hasUnknownArrayLength = (ref: CArrayType): boolean =>
    !ref.zeroTerminated && ref.lengthParameterIndex === undefined && ref.fixedSize === undefined;

export {
    hasUnknownArrayLength,
    LIST_FLAVOR_BY_NAME,
    type TypeId,
    type ListFlavor,
    type CArrayType,
    type ListType,
    type HashTableType,
    type StructuralType,
    type ParseContext,
};
