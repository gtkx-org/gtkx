import type { GirCallback } from "./callback.js";
import type { GirClass } from "./class.js";
import type { GirEnum } from "./enum.js";
import type { GirAlias, GirNamespace } from "./namespace.js";
import type { GirRecord } from "./record.js";
import type { StructuralType } from "./type-id.js";

/** A named entity a GIR namespace declares, discriminated by `kind` and carrying the parsed node. */
type EntityType =
    | {
        /** Discriminates {@link EntityType}. */
        kind: "class";
        /** Namespace declaring the class. */
        namespace: GirNamespace;
        /** Parsed class, carrying its GType metadata and the members it declares. */
        value: GirClass;
    } |
    {
        /** Discriminates {@link EntityType}. */
        kind: "interface";
        /** Namespace declaring the interface. */
        namespace: GirNamespace;
        /** Parsed interface, modeled the same way as a class. */
        value: GirClass;
    } |
    {
        /** Discriminates {@link EntityType}. */
        kind: "record";
        /** Namespace declaring the record. */
        namespace: GirNamespace;
        /** Parsed record, either a struct or a union. */
        value: GirRecord;
    } |
    {
        /** Discriminates {@link EntityType}. */
        kind: "enum";
        /** Namespace declaring the enumeration. */
        namespace: GirNamespace;
        /** Parsed enumeration or bitfield. */
        value: GirEnum;
    } |
    {
        /** Discriminates {@link EntityType}. */
        kind: "callback";
        /** Namespace declaring the callback. */
        namespace: GirNamespace;
        /** Parsed callback signature. */
        value: GirCallback;
    } |
    {
        /** Discriminates {@link EntityType}. */
        kind: "alias";
        /** Namespace declaring the alias. */
        namespace: GirNamespace;
        /** Parsed alias, holding the type it stands for. */
        value: GirAlias;
    };

/** What a GIR type reference resolves to: a structural type, or an entity a namespace declares. */
type GirType = StructuralType | EntityType;

export { type EntityType, type GirType };
