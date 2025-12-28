import type { FfiTypeDescriptor } from "@gtkx/gir";

export type CallbackWrapperOptions = {
    /** Name of the original callback/handler parameter */
    callbackName: string;
    /** Name for the wrapped callback variable */
    wrappedName: string;
    /** Argument types for the callback (for static mode) */
    argTypes?: FfiTypeDescriptor[];
    /** Return type for the callback */
    returnType?: FfiTypeDescriptor;
    /** Whether to handle a "self" argument (first arg, always wrapped as gobject) */
    hasSelfArg?: boolean;
    /** Indentation string */
    indent?: string;
    /**
     * Mode for type lookup:
     * - "static": Types are inlined in the generated code (for callbacks)
     * - "runtime": Types are looked up from a metadata variable at runtime (for signals)
     */
    mode?: "static" | "runtime";
    /** Variable name for runtime metadata (only used in runtime mode) */
    metadataVar?: string;
};

export type CallbackWrapperResult = {
    /** The generated wrapper code */
    code: string;
    /** Whether getNativeObject is used */
    usesGetNativeObject: boolean;
    /** Whether getNativeClass is used (for boxed types) */
    usesGetNativeClass: boolean;
    /** Whether GLib.Variant is used */
    usesGLibVariant: boolean;
};

/**
 * Generates the type check conditions for wrapping callback arguments.
 * Used by both static and runtime modes.
 */
function generateTypeChecks(options: {
    hasGObjectArgs: boolean;
    hasBoxedArgs: boolean;
    hasGVariantArgs: boolean;
    argVar: string;
    typeVar: string;
    indexVar: string;
    argsArrayVar: string;
    indent: string;
}): string[] {
    const { hasGObjectArgs, hasBoxedArgs, hasGVariantArgs, argVar, typeVar, argsArrayVar, indexVar, indent } = options;
    const checks: string[] = [];

    if (hasGObjectArgs) {
        checks.push(`${indent}if (${typeVar}?.type === "gobject" && ${argsArrayVar}[${indexVar}] != null) {`);
        checks.push(`${indent}  return getNativeObject(${argVar});`);
        checks.push(`${indent}}`);
    }

    if (hasBoxedArgs) {
        checks.push(`${indent}if (${typeVar}?.type === "boxed" && ${argsArrayVar}[${indexVar}] != null) {`);
        checks.push(`${indent}  const _cls = getNativeClass(${typeVar}.innerType);`);
        checks.push(`${indent}  return _cls ? getNativeObject(${argVar}, _cls) : ${argVar};`);
        checks.push(`${indent}}`);
    }

    if (hasGVariantArgs) {
        checks.push(`${indent}if (${typeVar}?.type === "gvariant" && ${argsArrayVar}[${indexVar}] != null) {`);
        checks.push(`${indent}  return getNativeObject(${argVar}, GLib.Variant);`);
        checks.push(`${indent}}`);
    }

    return checks;
}

/**
 * Generates wrapper code for a callback that converts raw GObject IDs to typed instances.
 * Used by both signal handlers and callback parameters in constructors/methods.
 *
 * Supports two modes:
 * - Static mode: Types are inlined in the generated code (for callbacks in constructors)
 * - Runtime mode: Types are looked up from metadata at runtime (for signal handlers)
 */
export function generateCallbackWrapperCode(options: CallbackWrapperOptions): CallbackWrapperResult {
    const {
        callbackName,
        wrappedName,
        argTypes = [],
        returnType,
        hasSelfArg = false,
        indent = "      ",
        mode = "static",
        metadataVar = "meta",
    } = options;

    let usesGetNativeObject = false;
    let usesGetNativeClass = false;
    let usesGLibVariant = false;

    const hasGObjectArgs = argTypes.some((t) => t.type === "gobject");
    const hasBoxedArgs = argTypes.some((t) => t.type === "boxed");
    const hasGVariantArgs = argTypes.some((t) => t.type === "gvariant");
    const returnsGObject = returnType?.type === "gobject";
    const needsArgWrapping = hasGObjectArgs || hasBoxedArgs || hasGVariantArgs;

    if (!needsArgWrapping && !returnsGObject && !hasSelfArg) {
        return { code: "", usesGetNativeObject: false, usesGetNativeClass: false, usesGLibVariant: false };
    }

    usesGetNativeObject = true;
    if (hasBoxedArgs) usesGetNativeClass = true;
    if (hasGVariantArgs) usesGLibVariant = true;

    const lines: string[] = [];
    lines.push(`${indent}const ${wrappedName} = (..._args: unknown[]) => {`);

    if (hasSelfArg) {
        lines.push(`${indent}  const _self = getNativeObject(_args[0]);`);
        lines.push(`${indent}  const _callbackArgs = _args.slice(1);`);
    } else {
        lines.push(`${indent}  const _callbackArgs = _args;`);
    }

    if (needsArgWrapping) {
        if (mode === "static") {
            const typesStr = JSON.stringify(argTypes);
            lines.push(`${indent}  const _types = ${typesStr} as const;`);
            lines.push(`${indent}  const _wrapped = _callbackArgs.map((_arg, _i) => {`);
            lines.push(`${indent}    const _t = _types[_i];`);

            const checks = generateTypeChecks({
                hasGObjectArgs,
                hasBoxedArgs,
                hasGVariantArgs,
                argVar: "_arg",
                typeVar: "_t",
                indexVar: "_i",
                argsArrayVar: "_callbackArgs",
                indent: `${indent}    `,
            });
            lines.push(...checks);

            lines.push(`${indent}    return _arg;`);
            lines.push(`${indent}  });`);
        } else {
            lines.push(`${indent}  if (!${metadataVar}) return ${callbackName}(_self, ..._callbackArgs);`);
            lines.push(`${indent}  const _wrapped = ${metadataVar}.params.map((_t, _i) => {`);

            const checks = generateTypeChecks({
                hasGObjectArgs,
                hasBoxedArgs,
                hasGVariantArgs,
                argVar: "_callbackArgs[_i]",
                typeVar: "_t",
                indexVar: "_i",
                argsArrayVar: "_callbackArgs",
                indent: `${indent}    `,
            });
            lines.push(...checks);

            lines.push(`${indent}    return _callbackArgs[_i];`);
            lines.push(`${indent}  });`);
        }

        if (mode === "static") {
            const argCount = argTypes.length;
            const argsList = Array.from({ length: argCount }, (_, i) => `_wrapped[${i}]`).join(", ");
            if (hasSelfArg) {
                lines.push(`${indent}  const _result = (${callbackName} as any)(_self, ${argsList});`);
            } else {
                lines.push(`${indent}  const _result = (${callbackName} as any)(${argsList});`);
            }
        } else {
            if (hasSelfArg) {
                lines.push(`${indent}  const _result = ${callbackName}(_self, ..._wrapped);`);
            } else {
                lines.push(`${indent}  const _result = ${callbackName}(..._wrapped);`);
            }
        }
    } else {
        if (hasSelfArg) {
            lines.push(`${indent}  const _result = ${callbackName}(_self, ...(_callbackArgs as any[]));`);
        } else {
            lines.push(`${indent}  const _result = ${callbackName}(...(_callbackArgs as any[]));`);
        }
    }

    if (returnsGObject) {
        lines.push(`${indent}  return _result != null ? (_result as any).id ?? _result : null;`);
    } else {
        lines.push(`${indent}  return _result;`);
    }

    lines.push(`${indent}};`);

    return {
        code: lines.join("\n"),
        usesGetNativeObject,
        usesGetNativeClass,
        usesGLibVariant,
    };
}

/**
 * Generates wrapper code for signal handlers using runtime metadata.
 * This is a convenience wrapper around generateCallbackWrapperCode for signals.
 */
export function generateSignalWrapperCode(options: {
    handlerName: string;
    wrappedName: string;
    metadataVar: string;
    hasGObjectParams: boolean;
    hasBoxedParams: boolean;
    hasGVariantParams: boolean;
    indent?: string;
}): CallbackWrapperResult {
    const {
        handlerName,
        wrappedName,
        metadataVar,
        hasGObjectParams,
        hasBoxedParams,
        hasGVariantParams,
        indent = "    ",
    } = options;

    const argTypes: FfiTypeDescriptor[] = [];
    if (hasGObjectParams) argTypes.push({ type: "gobject" });
    if (hasBoxedParams) argTypes.push({ type: "boxed" });
    if (hasGVariantParams) argTypes.push({ type: "gvariant" });

    return generateCallbackWrapperCode({
        callbackName: handlerName,
        wrappedName,
        argTypes,
        hasSelfArg: true,
        mode: "runtime",
        metadataVar,
        indent,
    });
}
