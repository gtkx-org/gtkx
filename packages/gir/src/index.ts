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
export { GirRepository } from "./repository.js";
export type {
    QualifiedName,
    TypeKind,
} from "./types.js";
export {
    NormalizedCallback,
    NormalizedClass,
    NormalizedConstant,
    NormalizedConstructor,
    NormalizedEnumeration,
    NormalizedEnumerationMember,
    NormalizedField,
    NormalizedFunction,
    NormalizedInterface,
    NormalizedMethod,
    NormalizedNamespace,
    NormalizedParameter,
    NormalizedProperty,
    NormalizedRecord,
    NormalizedSignal,
    NormalizedType,
    parseQualifiedName,
    qualifiedName,
} from "./types.js";

export { toCamelCase, toPascalCase } from "./utils.js";
