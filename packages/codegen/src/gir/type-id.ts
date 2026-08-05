import type { RawNode } from "./parse.js";
import type { PrimitiveCategory } from "./primitives.js";

/** A reference to a parsed type: the type table holding it, and its slot in that table. */
type TypeId = {
    /** Id of the table holding the type: a namespace's, or the internal one primitives and varargs intern into. */
    nsId: number;
    /** Slot the type occupies in that table. */
    id: number;
};

/** Which GLib container a {@link ListType} is. */
type ListFlavor = (typeof LIST_FLAVOR_BY_NAME)[keyof typeof LIST_FLAVOR_BY_NAME];

/** A type that marshals directly as a value, such as `gint` or `utf8`. */
type PrimitiveType = {
    /** Discriminates {@link StructuralType}. */
    kind: "primitive";
    /** The scalar the type marshals as. */
    category: PrimitiveCategory;
};

/** The trailing `...` argument list of a variadic C function. */
type VarargsType = {
    /** Discriminates {@link StructuralType}. */
    kind: "varargs";
};

/** A C array, along with whatever the GIR says about how its length is determined. */
type CArrayType = {
    /** Discriminates {@link StructuralType}. */
    kind: "carray";
    /** Type of the array's elements, paired with `elementCType` to build the element descriptor. */
    element: TypeId;
    /** C declaration of an element, which tells an inline struct apart from a pointer to one. */
    elementCType: string | undefined;
    /** C declaration of the array itself. */
    arrayCType: string | undefined;
    /** Index of the parameter, or of the sibling record field, carrying the length. */
    lengthParameterIndex: number | undefined;
    /** Element count when the array has a fixed size. */
    fixedSize: number | undefined;
    /** Whether the array ends at a null element. */
    isZeroTerminated: boolean;
};

/** A GLib list or array container over a single element type. */
type ListType = {
    /** Discriminates {@link StructuralType}. */
    kind: "list";
    /** Which container the type is. */
    flavor: ListFlavor;
    /** Type the container's elements marshal as, which the list descriptor wraps. */
    element: TypeId;
};

/** A `GLib.HashTable`. */
type HashTableType = {
    /** Discriminates {@link StructuralType}. */
    kind: "hashtable";
    /** Type the keys marshal as, rendered as the key half of a `Record` or `Map`. */
    key: TypeId;
    /** Type the values marshal as, rendered as the value half of a `Record` or `Map`. */
    value: TypeId;
};

/** A type the GIR describes by its structure rather than by a name it declares. */
type StructuralType = PrimitiveType | VarargsType | CArrayType | ListType | HashTableType;

/** The hooks the GIR parsers use to reference and register types while walking one namespace. */
type ParseContext = {
    /** Id of the namespace being parsed. */
    nsId: number;
    /** Resolves a GIR type name, optionally namespace-qualified, reserving a slot when it is not parsed yet. */
    findType(name: string): TypeId;
    /** Interns a primitive type and returns its id. */
    addPrimitive(category: PrimitiveCategory): TypeId;
    /** Interns the varargs type and returns its id. */
    addVarargs(): TypeId;
    /** Registers an unnamed container type in the namespace and returns its id. */
    addContainer(type: CArrayType | ListType | HashTableType): TypeId;
    /** Parses an inline `<callback>` node, registers it as an unnamed type, and returns its id. */
    addAnonymousCallback(node: RawNode): TypeId;
};

/** GIR type names of the GLib containers, mapped to the {@link ListFlavor} each one parses to. */
const LIST_FLAVOR_BY_NAME = {
    "GLib.List": "glist",
    "GLib.SList": "gslist",
    "GLib.PtrArray": "gptrarray",
    "GLib.Array": "garray",
    "GLib.ByteArray": "gbytearray",
} as const;

const hasUnknownArrayLength = (ref: CArrayType): boolean =>
    !ref.isZeroTerminated && ref.lengthParameterIndex === undefined && ref.fixedSize === undefined;

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
