import type { ModuleContext } from "../dsl/context.js";
import { indent, quote } from "../dsl/emit.js";

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
    readonly construction?: string | undefined;
    readonly vfuncs?: string | undefined;
    readonly signals?: string | undefined;
};

/**
 * Appends the single `registerNativeClass(Class, { … })` registration that
 * collapses a type's GType, construction, vfunc, and signal metadata into one
 * module-load call.
 *
 * Emits nothing when the registration carries no metadata at all, so callers
 * can pass the result of optional sub-renderers without pre-checking.
 *
 * @param ctx - The module context
 * @param registration - The pre-rendered descriptor pieces
 */
export const appendNativeClassRegistration = (ctx: ModuleContext, registration: NativeClassRegistration): void => {
    const { className, role, getTypeRef, construction, vfuncs, signals } = registration;
    if (getTypeRef === undefined && construction === undefined && vfuncs === undefined && signals === undefined) {
        return;
    }
    ctx.addRuntimeImport("registerNativeClass");
    const lines: string[] = [`role: ${quote(role)},`];
    if (getTypeRef !== undefined) lines.push(`gtype: ${getTypeRef},`);
    if (construction !== undefined) lines.push(`construction: ${construction},`);
    if (vfuncs !== undefined) lines.push(`vfuncs: ${vfuncs},`);
    if (signals !== undefined) lines.push(`signals: ${signals},`);
    const body = lines.map((line) => indent(line, 1)).join("\n");
    ctx.module.appendRegistration(`registerNativeClass(${className}, {\n${body}\n});`);
};
