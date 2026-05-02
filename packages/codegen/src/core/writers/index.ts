import { type ClassDeclarationBuilder, method, param } from "../../builders/index.js";
import type { FfiMapper } from "../type-system/ffi-mapper.js";
import type { FfiDescriptorRegistry } from "./descriptor-registry.js";
import { FfiTypeWriter } from "./ffi-type-writer.js";
import { type ImportCollector, MethodBodyWriter, type MethodStructure } from "./method-body-writer.js";

export type { ImportCollector, MethodStructure } from "./method-body-writer.js";
export { addTypeImports, MethodBodyWriter } from "./method-body-writer.js";

/**
 * Adds a built MethodStructure to a class as a generated method.
 *
 * Centralizes the MethodStructure → MethodBuilder conversion that is shared
 * between class, record, interface, and standalone-function generators.
 */
export const addMethodStructure = (cls: ClassDeclarationBuilder, struct: MethodStructure): void => {
    cls.addMethod(
        method(struct.name, {
            params: struct.parameters.map((p) =>
                param(p.name, p.type, { optional: p.optional, rest: p.isRestParameter }),
            ),
            returnType: struct.returnType,
            body: struct.statements,
            isStatic: struct.isStatic,
            doc: struct.docs?.[0]?.description,
            overloads: struct.overloads?.map((o) => ({
                params: o.params.map((p) => param(p.name, p.type, { optional: p.optional, rest: p.isRestParameter })),
                returnType: o.returnType,
            })),
        }),
    );
};

type CreateMethodBodyWriterOptions = {
    sharedLibrary?: string;
    glibLibrary?: string;
    selfNames?: ReadonlySet<string>;
    /**
     * Per-file FFI descriptor registry. When supplied, non-variadic call
     * expressions are hoisted to `fn(...)` declarations and emitted as
     * curried invocations at the call site.
     */
    descriptors?: FfiDescriptorRegistry;
};

export const createMethodBodyWriter = (
    ffiMapper: FfiMapper,
    imports: ImportCollector,
    options: CreateMethodBodyWriterOptions = {},
): MethodBodyWriter => {
    const ffiTypeWriter = new FfiTypeWriter({
        currentSharedLibrary: options.sharedLibrary,
        glibLibrary: options.glibLibrary,
    });

    const descriptors = options.descriptors ?? (imports as { descriptors?: FfiDescriptorRegistry }).descriptors;
    const writer = new MethodBodyWriter(ffiMapper, imports, ffiTypeWriter, descriptors);
    if (options.selfNames) {
        writer.setSelfNames(options.selfNames);
    }
    return writer;
};

/**
 * Rewrites argument expressions for parameters that follow a NativeHandle-or-overload
 * first argument: any access of `name.foo` is rewritten to `name!.foo` so the codegen
 * output asserts non-null in the constructor branch where TypeScript narrowed the
 * parameter via the `isNativeHandle` overload check.
 */
export const applyForcedNonNullArgs = (args: { value: string }[], forcedNames: Iterable<string>): void => {
    for (const arg of args) {
        for (const name of forcedNames) {
            if (arg.value.startsWith(`${name}.`)) {
                arg.value = arg.value.replace(`${name}.`, `${name}!.`);
            }
        }
    }
};
