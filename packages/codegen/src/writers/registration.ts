import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";

/**
 * The pre-rendered pieces of a single `registerNativeClass(...)` descriptor.
 *
 * Each metadata field is the already-rendered object-literal fragment for that
 * descriptor key, or `undefined` when the type contributes nothing for it.
 */
export type NativeClassRegistration = {
    readonly className: string;
    readonly role: "class" | "interface" | "boxed";
    readonly getTypeRef?: string | undefined;
    readonly vfuncs?: string | undefined;
};

/**
 * Appends the single `registerNativeClass(Class, { … })` registration that
 * collapses a type's GType and vfunc metadata into one module-load call.
 *
 * Emits nothing when the registration carries no metadata at all, so callers
 * can pass the result of optional sub-renderers without pre-checking.
 *
 * @param context - The module context
 * @param registration - The pre-rendered descriptor pieces
 */
export const appendNativeClassRegistration = (context: ModuleContext, registration: NativeClassRegistration): void => {
    const { className, role, getTypeRef, vfuncs } = registration;
    if (getTypeRef === undefined && vfuncs === undefined) {
        return;
    }
    context.addRuntimeImport("registerNativeClass");
    const lines: string[] = [`role: ${quote(role)},`];
    if (getTypeRef !== undefined) lines.push(`gtype: ${getTypeRef},`);
    if (vfuncs !== undefined) lines.push(`vfuncs: ${vfuncs},`);
    const body = lines.map((line) => indent(line, 1)).join("\n");
    context.module.appendRegistration(`registerNativeClass(${className}, {\n${body}\n});`);
};
