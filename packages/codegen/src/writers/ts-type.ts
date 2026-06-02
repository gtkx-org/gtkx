import type { ModuleContext } from "../dsl/context.js";
import { aliasExportName } from "../dsl/identifier.js";
import { PRIMITIVE_TS_TYPE } from "../gir/primitives.js";
import type { ResolvedNamed } from "../gir/repository.js";
import type { GirTypeRef, NamedTypeRef } from "../gir/type-ref.js";

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
 * Strategy describing the type-ref shapes the FFI and React generators render
 * differently: container style (`Map` vs `Record`), the callback placeholder,
 * whether a `GByteArray` collapses to `number[]`, and how a named reference is
 * qualified and imported. {@link renderBaseTypeFor} renders every other shape
 * identically for both.
 */
export type TsTypeTarget = {
    /** `"map"` → `Map<K, V>`; `"record"` → `Record<K, V>`. */
    readonly containerStyle: "map" | "record";
    /** The placeholder emitted for a callback type. */
    readonly callbackType: string;
    /** Whether a `GByteArray` renders as `number[]` instead of `element[]`. */
    readonly byteArrayAsNumber: boolean;
    /** Renders a named reference (class/interface/boxed/enum/callback/alias). */
    readonly renderNamed: (ref: NamedTypeRef) => string;
};

/**
 * Renders the TypeScript annotation for a `GirTypeRef`, dispatching the shapes
 * both generators share and delegating the divergent ones to {@link target}.
 *
 * @param target - The per-generator rendering strategy
 * @param ref - The type reference, or `undefined` for void
 */
export const renderBaseTypeFor = (target: TsTypeTarget, ref: GirTypeRef | undefined): string => {
    if (ref === undefined) return "void";
    switch (ref.kind) {
        case "primitive":
            return PRIMITIVE_TS_TYPE[ref.category];
        case "varargs":
            return "unknown[]";
        case "callback":
            return target.callbackType;
        case "named":
            return target.renderNamed(ref);
        case "array":
            return `${renderBaseTypeFor(target, ref.element)}[]`;
        case "list":
            if (ref.flavor === "gbytearray" && target.byteArrayAsNumber) return "number[]";
            return `${renderBaseTypeFor(target, ref.element)}[]`;
        case "hashtable": {
            const key = renderBaseTypeFor(target, ref.key);
            const value = renderBaseTypeFor(target, ref.value);
            return target.containerStyle === "record" ? `Record<${key}, ${value}>` : `Map<${key}, ${value}>`;
        }
    }
};

const moduleTarget = (context: ModuleContext): TsTypeTarget => ({
    containerStyle: "map",
    callbackType: "((...args: any[]) => any)",
    byteArrayAsNumber: true,
    renderNamed: (ref) => namedTsType(context, ref),
});

/**
 * Renders a TypeScript type annotation for a `GirTypeRef` in an FFI module:
 * classes/interfaces/boxeds/enums/callbacks as their qualified identifier,
 * arrays and lists as `T[]`, hashtables as `Map<K, V>`, primitives to their TS
 * counterpart, and `undefined` to `void`.
 *
 * @param context - The module context
 * @param ref - The type reference, or `undefined` for void
 * @param isNullable - Whether the slot accepts `null`
 */
export const renderTsType = (context: ModuleContext, ref: GirTypeRef | undefined, isNullable = false): string => {
    const base = renderBaseTypeFor(moduleTarget(context), ref);
    return isNullable ? `${base} | null` : base;
};

const namedTsType = (context: ModuleContext, ref: NamedTypeRef): string => {
    const namespaceName = ref.namespaceName ?? context.namespace.name;
    const resolved = context.repository.resolveNamed(namespaceName, ref.typeName);
    if (resolved === undefined) {
        return context.qualify(namespaceName, ref.typeName);
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
            return context.qualify(namespaceName, typeName);
        case "alias":
            return context.qualify(namespaceName, aliasExportName(namespaceName, typeName));
    }
};
