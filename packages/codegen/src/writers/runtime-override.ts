import type { GirFunction } from "../gir/function.js";

/**
 * Shape of a method that codegen cannot marshal and that the FFI runtime
 * replaces on the prototype at module load.
 */
type RuntimeOverride = {
    /** Optional generic parameter list, including angle brackets. */
    readonly generics?: string;
    /** Comma-separated TypeScript parameter list. */
    readonly signature: string;
    /** TypeScript return-type annotation. */
    readonly returnType: string;
    /** Body executed when the runtime override has not been installed yet. */
    readonly body: string;
};

const RUNTIME_OVERRIDES: ReadonlyMap<string, RuntimeOverride> = new Map([
    [
        "g_value_get_boxed",
        {
            generics: "<T = unknown>",
            signature: "",
            returnType: "T",
            body: 'throw new Error("g_value_get_boxed: runtime override not installed");',
        },
    ],
    [
        "g_value_set_boxed",
        {
            signature: "boxed: object | null",
            returnType: "void",
            body: 'throw new Error("g_value_set_boxed: runtime override not installed");',
        },
    ],
]);

/**
 * Renders the method body for a callable whose marshaling is provided by a
 * hand-written runtime override.
 *
 * `gpointer` exchanges (`GValue` boxed accessors and similar) cannot be
 * marshaled from GIR alone; the FFI runtime replaces them on the prototype
 * at module load. The codegen emits a stub with the override's signature
 * so the consumer types resolve to the runtime shape and the runtime's
 * `prototype` assignment type-checks.
 *
 * Returns `undefined` for callables without a registered override.
 *
 * @param callable - The callable to consider
 * @param memberName - The camelCase JS method name
 */
export const renderRuntimeOverride = (callable: GirFunction, memberName: string): string | undefined => {
    if (callable.cIdentifier === undefined) return undefined;
    const override = RUNTIME_OVERRIDES.get(callable.cIdentifier);
    if (override === undefined) return undefined;
    const generics = override.generics ?? "";
    return `${memberName}${generics}(${override.signature}): ${override.returnType} {\n    ${override.body}\n}`;
};
