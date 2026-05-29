import type { ModuleContext } from "../dsl/context.js";
import { pascalCase } from "../dsl/identifier.js";
import type { GirNamespace } from "../gir/namespace.js";
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
 * Routes through resolution (classes/interfaces/boxeds/enums as their
 * PascalCase type, callbacks as `Function`,
 * arrays as `T[]`, lists as `T[]`, hashtables as `Record<K, V>`, primitive
 * categories to their TS counterpart, and `undefined` to `void`).
 *
 * @param ctx - The module context
 * @param ref - The type reference, or `undefined` for void
 * @param isNullable - Whether the slot accepts `null`
 */
export const writeTsType = (ctx: ModuleContext, ref: GirTypeRef | undefined, isNullable = false): string => {
    const base = writeBaseType(ctx, ref);
    return isNullable ? `${base} | null` : base;
};

const writeBaseType = (ctx: ModuleContext, ref: GirTypeRef | undefined): string => {
    if (ref === undefined) return "void";
    switch (ref.kind) {
        case "primitive":
            return primitiveTsType(ref);
        case "varargs":
            return "unknown[]";
        case "callback":
            return "((...args: any[]) => any)";
        case "named":
            return namedTsType(ctx, ref);
        case "array":
            return arrayTsType(ctx, ref);
        case "list":
            return listTsType(ctx, ref);
        case "hashtable":
            return hashTableTsType(ctx, ref);
    }
};

const primitiveTsType = (ref: PrimitiveTypeRef): string => PRIMITIVE_TS_TYPE[ref.category];

const namedTsType = (ctx: ModuleContext, ref: NamedTypeRef): string => {
    const namespaceName = ref.namespaceName ?? ctx.namespace.name;
    const resolved = ctx.repository.resolveNamed(namespaceName, ref.typeName);
    if (resolved === undefined) {
        return qualifiedTypeReference(ctx, namespaceName, ref.typeName);
    }
    return resolvedTsType(ctx, namespaceName, ref.typeName, resolved);
};

const resolvedTsType = (
    ctx: ModuleContext,
    namespaceName: string,
    typeName: string,
    resolved: ResolvedNamed,
): string => {
    switch (resolved.kind) {
        case "class":
        case "interface":
        case "boxed":
        case "enum":
            return qualifiedTypeReference(ctx, namespaceName, typeName);
        case "callback":
            return "((...args: any[]) => any)";
        case "alias":
            return resolveAliasTsType(ctx, resolved.namespace, resolved.target, typeName);
    }
};

const resolveAliasTsType = (
    ctx: ModuleContext,
    namespace: GirNamespace,
    target: string | undefined,
    fallbackName: string,
): string => {
    if (target === undefined) {
        return qualifiedTypeReference(ctx, namespace.name, fallbackName);
    }
    return qualifiedTypeReference(ctx, namespace.name, target);
};

const qualifiedTypeReference = (ctx: ModuleContext, namespaceName: string, typeName: string): string => {
    if (namespaceName === ctx.namespace.name) return pascalCase(typeName);
    const alias = ctx.addCrossNamespaceImport(namespaceName);
    return `${alias}.${pascalCase(typeName)}`;
};

const arrayTsType = (ctx: ModuleContext, ref: ArrayTypeRef): string => {
    const element = writeBaseType(ctx, ref.element);
    return `${element}[]`;
};

const listTsType = (ctx: ModuleContext, ref: ListTypeRef): string => {
    if (ref.flavor === "gbytearray") return "number[]";
    const element = writeBaseType(ctx, ref.element);
    return `${element}[]`;
};

const hashTableTsType = (ctx: ModuleContext, ref: HashTableTypeRef): string => {
    const key = writeBaseType(ctx, ref.key);
    const value = writeBaseType(ctx, ref.value);
    return `Map<${key}, ${value}>`;
};
