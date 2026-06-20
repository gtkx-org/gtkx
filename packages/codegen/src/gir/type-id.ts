import type { RawNode } from "./parse.js";
import type { PrimitiveCategory } from "./primitives.js";

export type TypeId = { nsId: number; id: number };

export const LIST_FLAVOR_BY_NAME = {
    "GLib.List": "glist",
    "GLib.SList": "gslist",
    "GLib.PtrArray": "gptrarray",
    "GLib.Array": "garray",
    "GLib.ByteArray": "gbytearray",
} as const;

export type ListFlavor = (typeof LIST_FLAVOR_BY_NAME)[keyof typeof LIST_FLAVOR_BY_NAME];

export type PrimitiveType = { kind: "primitive"; category: PrimitiveCategory };

export type VarargsType = { kind: "varargs" };

export type CArrayType = {
    kind: "carray";
    element: TypeId;
    elementCType: string | undefined;
    lengthParameterIndex: number | undefined;
    fixedSize: number | undefined;
};

export type GListType = {
    kind: "list";
    flavor: ListFlavor;
    element: TypeId;
};

export type GHashTableType = {
    kind: "hashtable";
    key: TypeId;
    value: TypeId;
};

export type StructuralType = PrimitiveType | VarargsType | CArrayType | GListType | GHashTableType;

export type ParseContext = {
    nsId: number;
    findOrStubType(name: string): TypeId;
    internPrimitive(category: PrimitiveCategory): TypeId;
    internVarargs(): TypeId;
    internContainer(type: CArrayType | GListType | GHashTableType): TypeId;
    internInlineCallback(node: RawNode): TypeId;
};
