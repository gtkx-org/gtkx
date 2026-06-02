import type { ModuleContext } from "../dsl/context.js";
import { aliasExportName } from "../dsl/identifier.js";
import { PRIMITIVE_TS_TYPE } from "../gir/primitives.js";
import type { ResolvedNamed } from "../gir/repository.js";
import type {
    ArrayTypeRef,
    GirTypeRef,
    HashTableTypeRef,
    ListTypeRef,
    NamedTypeRef,
    PrimitiveTypeRef,
} from "../gir/type-ref.js";

/**
 * TypeScript type annotations the writers emit alongside runtime values.
 *
 * Generated `.ts` files are consumed both as runtime modules (transpiled to
 * `.js`) and as declaration sources (`ts.transpileDeclaration` extracts the
 * `.d.ts` shape). Every exported value, parameter, and return position
 * therefore carries an explicit annotation so isolated declaration emit
 * succeeds without inference. The helpers below produce those annotations
 * from the same `GirTypeRef` shapes the runtime FFI writers consume,
 * importing referenced cross-namespace classes on demand.
 */

/**
 * Renders a TypeScript type annotation for a `GirTypeRef`.
 *
 * Routes through resolution (classes/interfaces/boxeds/enums/callbacks as their
 * named TypeScript identifier — the GIR `name` verbatim,
 * arrays as `T[]`, lists as `T[]`, hashtables as `Record<K, V>`, primitive
 * categories to their TS counterpart, and `undefined` to `void`).
 *
 * @param context - The module context
 * @param ref - The type reference, or `undefined` for void
 * @param isNullable - Whether the slot accepts `null`
 */
export const renderTsType = (context: ModuleContext, ref: GirTypeRef | undefined, isNullable = false): string => {
    const base = renderBaseType(context, ref);
    return isNullable ? `${base} | null` : base;
};

const renderBaseType = (context: ModuleContext, ref: GirTypeRef | undefined): string => {
    if (ref === undefined) return "void";
    switch (ref.kind) {
        case "primitive":
            return primitiveTsType(ref);
        case "varargs":
            return "unknown[]";
        case "callback":
            return "((...args: any[]) => any)";
        case "named":
            return namedTsType(context, ref);
        case "array":
            return arrayTsType(context, ref);
        case "list":
            return listTsType(context, ref);
        case "hashtable":
            return hashTableTsType(context, ref);
    }
};

const primitiveTsType = (ref: PrimitiveTypeRef): string => PRIMITIVE_TS_TYPE[ref.category];

const namedTsType = (context: ModuleContext, ref: NamedTypeRef): string => {
    const namespaceName = ref.namespaceName ?? context.namespace.name;
    const resolved = context.repository.resolveNamed(namespaceName, ref.typeName);
    if (resolved === undefined) {
        return qualifiedTypeReference(context, namespaceName, ref.typeName);
    }
    return resolvedTsType(context, namespaceName, ref.typeName, resolved);
};

const resolvedTsType = (
    context: ModuleContext,
    namespaceName: string,
    typeName: string,
    resolved: ResolvedNamed,
): string => {
    switch (resolved.kind) {
        case "class":
        case "interface":
        case "boxed":
        case "enum":
        case "callback":
            return qualifiedTypeReference(context, namespaceName, typeName);
        case "alias": {
            const exportName = aliasExportName(namespaceName, typeName);
            if (namespaceName === context.namespace.name) return exportName;
            return `${context.addCrossNamespaceImport(namespaceName)}.${exportName}`;
        }
    }
};

const qualifiedTypeReference = (context: ModuleContext, namespaceName: string, typeName: string): string => {
    if (namespaceName === context.namespace.name) return typeName;
    const alias = context.addCrossNamespaceImport(namespaceName);
    return `${alias}.${typeName}`;
};

const arrayTsType = (context: ModuleContext, ref: ArrayTypeRef): string => {
    const element = renderBaseType(context, ref.element);
    return `${element}[]`;
};

const listTsType = (context: ModuleContext, ref: ListTypeRef): string => {
    if (ref.flavor === "gbytearray") return "number[]";
    const element = renderBaseType(context, ref.element);
    return `${element}[]`;
};

const hashTableTsType = (context: ModuleContext, ref: HashTableTypeRef): string => {
    const key = renderBaseType(context, ref.key);
    const value = renderBaseType(context, ref.value);
    return `Map<${key}, ${value}>`;
};
