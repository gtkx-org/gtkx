/**
 * @gtkx/gir - GObject Introspection Repository
 *
 * Pure GIR data layer with normalized types and a queryable API.
 * All type references use fully qualified names (Namespace.TypeName).
 *
 * @example
 * ```typescript
 * import { GirRepository } from "@gtkx/gir";
 *
 * const repo = new GirRepository();
 * await repo.loadFromDirectory("./girs");
 * repo.resolve();
 *
 * const button = repo.resolveClass("Gtk.Button" as QualifiedName);
 * button.isSubclassOf("Gtk.Widget" as QualifiedName); // true
 * button.getInheritanceChain();
 * // ["Gtk.Button", "Gtk.Widget", "GObject.InitiallyUnowned", "GObject.Object"]
 * ```
 *
 * @packageDocumentation
 */

export {
    INTRINSIC_TYPES,
    isIntrinsicType,
    isNumericType,
    isStringType,
    isVoidType,
    NUMERIC_TYPES,
    STRING_TYPES,
    VOID_TYPES,
} from "./intrinsics.js";
export { GirRepository, type RepositoryOptions } from "./repository.js";
export type {
    ContainerType,
    DefaultValue,
    QualifiedName,
    TypeKind,
} from "./types.js";
export {
    GirAlias,
    GirCallback,
    GirClass,
    GirConstant,
    GirConstructor,
    GirEnumeration,
    GirEnumerationMember,
    GirField,
    GirFunction,
    GirInterface,
    GirMethod,
    GirNamespace,
    GirParameter,
    GirProperty,
    GirRecord,
    GirSignal,
    GirType,
    parseDefaultValue,
    parseQualifiedName,
    qualifiedName,
} from "./types.js";

export { toCamelCase, toPascalCase } from "./utils.js";
