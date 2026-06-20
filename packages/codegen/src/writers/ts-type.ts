import type { ModuleContext } from "../dsl/context.js";
import { aliasExportName } from "../dsl/identifier.js";
import { PRIMITIVE_TS_TYPE } from "../gir/primitives.js";
import type { GirRepository } from "../gir/repository.js";
import type { GirType } from "../gir/type.js";
import type { TypeId } from "../gir/type-id.js";
import { gtypeTsType } from "./gtype-binding.js";

/**
 * TypeScript type annotations the writers emit alongside runtime values.
 *
 * Generated `.ts` files are consumed both as runtime modules (transpiled to
 * `.js`) and as declaration sources (`ts.transpileDeclaration` extracts the
 * `.d.ts` shape). Every exported value, parameter, and return position
 * therefore carries an explicit annotation so isolated declaration emit
 * succeeds without inference. The helpers below produce those annotations
 * from the same interned type handles the runtime FFI writers consume,
 * importing referenced cross-namespace classes on demand.
 */

/** The namespace-qualified name of an interned reference, recovered via `nameOf`. */
export type ReferenceName = {
    readonly namespaceName: string;
    readonly typeName: string;
};

/**
 * Strategy describing the type shapes the FFI and React generators render
 * differently: container style (`Map` vs `Record`), the callback placeholder,
 * whether a `GByteArray` collapses to `number[]`, and how a named reference is
 * qualified and imported. {@link renderBaseTypeFor} renders every other shape
 * identically for both.
 */
export type TsTypeTarget = {
    /** `"map"` → `Map<K, V>`; `"record"` → `Record<K, V>`. */
    readonly containerStyle: "map" | "record";
    /** The placeholder emitted for an inline callback type. */
    readonly callbackType: string;
    /** Whether a `GByteArray` renders as `number[]` instead of `element[]`. */
    readonly byteArrayAsNumber: boolean;
    /**
     * Renders a named reference from its resolved type (`undefined` when the
     * reference is an unresolved forward stub) and its recovered name.
     */
    readonly renderNamed: (resolved: GirType | undefined, name: ReferenceName) => string;
    /** Renders the `GType` alias, adding the import the surrounding module needs. */
    readonly renderGtype: () => string;
};

/**
 * Renders the TypeScript annotation for an interned type handle, dispatching the
 * shapes both generators share and delegating the divergent ones to
 * {@link target}.
 *
 * @param repository - The GIR repository, to resolve and name the handle
 * @param target - The per-generator rendering strategy
 * @param ref - The interned type slot, or `undefined` for void
 */
export const renderBaseTypeFor = (repository: GirRepository, target: TsTypeTarget, ref: TypeId | undefined): string => {
    if (ref === undefined) return "void";
    const type = repository.typeOf(ref);
    const name = repository.nameOf(ref);
    if (type === undefined) return renderNamedType(target, undefined, name);
    switch (type.kind) {
        case "primitive":
            return type.category === "gtype" ? target.renderGtype() : PRIMITIVE_TS_TYPE[type.category];
        case "varargs":
            return "unknown[]";
        case "callback":
        case "class":
        case "interface":
        case "boxed":
        case "enum":
        case "alias":
            return renderNamedType(target, type, name);
        case "carray":
            return `${renderBaseTypeFor(repository, target, type.element)}[]`;
        case "list":
            if (type.flavor === "gbytearray" && target.byteArrayAsNumber) return "number[]";
            return `${renderBaseTypeFor(repository, target, type.element)}[]`;
        case "hashtable": {
            const key = renderBaseTypeFor(repository, target, type.key);
            const value = renderBaseTypeFor(repository, target, type.value);
            return target.containerStyle === "record" ? `Record<${key}, ${value}>` : `Map<${key}, ${value}>`;
        }
    }
};

/**
 * Renders a named reference, falling back when its name is unrecoverable: an
 * anonymous inline callback renders the target's callback placeholder, any other
 * nameless slot renders `unknown`.
 */
const renderNamedType = (
    target: TsTypeTarget,
    resolved: GirType | undefined,
    name: ReferenceName | undefined,
): string => {
    if (name === undefined) return resolved?.kind === "callback" ? target.callbackType : "unknown";
    return target.renderNamed(resolved, name);
};

const moduleTarget = (context: ModuleContext): TsTypeTarget => ({
    containerStyle: "map",
    callbackType: "((...args: any[]) => any)",
    byteArrayAsNumber: true,
    renderNamed: (resolved, name) =>
        resolved?.kind === "alias"
            ? context.qualify(name.namespaceName, aliasExportName(name.namespaceName, name.typeName))
            : context.qualify(name.namespaceName, name.typeName),
    renderGtype: () => gtypeTsType(context),
});

/**
 * Renders a TypeScript type annotation for an interned type handle in an FFI
 * module: classes/interfaces/boxeds/enums/callbacks as their qualified
 * identifier, arrays and lists as `T[]`, hashtables as `Map<K, V>`, primitives
 * to their TS counterpart, and `undefined` to `void`.
 *
 * @param context - The module context
 * @param ref - The interned type slot, or `undefined` for void
 * @param isNullable - Whether the slot accepts `null`
 */
export const renderTsType = (context: ModuleContext, ref: TypeId | undefined, isNullable = false): string => {
    const base = renderBaseTypeFor(context.repository, moduleTarget(context), ref);
    return isNullable ? `${base} | null` : base;
};
