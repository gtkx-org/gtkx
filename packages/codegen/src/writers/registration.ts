import type { ModuleContext } from "../dsl/context.js";

/**
 * The pre-rendered pieces of a single `registerWrapperClass(...)` registration.
 *
 * `gtypeExpr` is the already-rendered expression resolving the type's runtime
 * `GType`; `vfuncs` is the rendered vtable-descriptor literal, or `undefined`
 * when the type exposes no overridable slots.
 */
export type WrapperClassRegistration = {
    readonly className: string;
    readonly gtypeExpr?: string | undefined;
    readonly vfuncs?: string | undefined;
};

/**
 * Appends the single `registerWrapperClass(Class, gtype, vfuncs?)` registration
 * that records a type's identity and vtable metadata at module load.
 *
 * Emits nothing when the type has no resolvable `GType`, since the registration
 * is keyed on it and the runtime derives the type's kind from it.
 *
 * @param context - The module context
 * @param registration - The pre-rendered registration pieces
 */
export const appendWrapperClassRegistration = (
    context: ModuleContext,
    registration: WrapperClassRegistration,
): void => {
    const { className, gtypeExpr, vfuncs } = registration;
    if (gtypeExpr === undefined) {
        return;
    }
    context.addRuntimeImport("registerWrapperClass");
    const args = vfuncs === undefined ? gtypeExpr : `${gtypeExpr}, ${vfuncs}`;
    context.module.appendRegistration(`registerWrapperClass(${className}, ${args});`);
};
