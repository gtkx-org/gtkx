/**
 * FFI Type Writer
 *
 * Writes FFI type descriptor object literals for code generation.
 * Uses ts-morph WriterFunction for optimal AST construction.
 */

import { type WriterFunction, Writers } from "ts-morph";
import type { FfiTypeDescriptor } from "../type-system/ffi-types.js";

/**
 * Options for the FFI type writer.
 */
export type FfiTypeWriterOptions = {
    /** Current shared library for boxed types without explicit lib */
    currentSharedLibrary?: string;
    /** GLib shared library for GError types (derived from GIR) */
    glibLibrary?: string;
};

/**
 * Represents a property for an object literal.
 */
type ObjectProperty = {
    name: string;
    value: string | number | boolean | WriterFunction;
};

/**
 * Writes FFI type descriptor object literals.
 *
 * This is the single source of truth for generating type descriptor code.
 * Uses ts-morph WriterFunction for optimal AST construction.
 *
 * @example
 * ```typescript
 * const writer = new FfiTypeWriter({ currentSharedLibrary: "libgtk-4.so.1" });
 *
 * // ts-morph WriterFunction
 * const writerFn = writer.toWriter({ type: "gobject", ownership: "none" });
 * classDecl.addProperty({ name: "TYPE", initializer: writerFn });
 * ```
 */
export class FfiTypeWriter {
    private options: FfiTypeWriterOptions;

    constructor(options: FfiTypeWriterOptions = {}) {
        this.options = options;
    }

    /**
     * Sets the current shared library for boxed types.
     */
    setSharedLibrary(lib: string): void {
        this.options.currentSharedLibrary = lib;
    }

    /**
     * Creates a GError ref type descriptor for error out parameters.
     * Requires glibLibrary to be set in options.
     */
    createGErrorRefTypeDescriptor(): FfiTypeDescriptor {
        if (!this.options.glibLibrary) {
            throw new Error("glibLibrary must be set in FfiTypeWriterOptions for GError types");
        }
        return {
            type: "ref",
            innerType: {
                type: "boxed",
                ownership: "full",
                innerType: "GError",
                lib: this.options.glibLibrary,
            },
        };
    }

    /**
     * Builds a type descriptor as a ts-morph WriterFunction.
     *
     * @param type - The FFI type descriptor
     * @returns WriterFunction that writes the object literal
     */
    toWriter(type: FfiTypeDescriptor): WriterFunction {
        const properties = this.buildProperties(type);
        return Writers.object(this.propertiesToWriterObject(properties));
    }

    /**
     * Builds an error argument descriptor as WriterFunction.
     * Requires glibLibrary to be set in options.
     */
    errorArgumentWriter(): WriterFunction {
        if (!this.options.glibLibrary) {
            throw new Error("glibLibrary must be set in FfiTypeWriterOptions for GError types");
        }
        return Writers.object({
            type: '"ref"',
            innerType: Writers.object({
                type: '"boxed"',
                ownership: '"full"',
                innerType: '"GError"',
                lib: `"${this.options.glibLibrary}"`,
            }),
        });
    }

    /**
     * Builds a self argument descriptor as WriterFunction.
     */
    selfArgumentWriter(options: {
        isRecord?: boolean;
        recordName?: string;
        sharedLibrary?: string;
        isParamSpec?: boolean;
    }): WriterFunction {
        if (options.isRecord && options.recordName) {
            const lib = options.sharedLibrary ?? this.options.currentSharedLibrary ?? "";
            return Writers.object({
                type: '"boxed"',
                ownership: '"none"',
                innerType: `"${options.recordName}"`,
                lib: `"${lib}"`,
            });
        }
        if (options.isParamSpec) {
            return Writers.object({ type: '"gparam"', ownership: '"none"' });
        }
        return Writers.object({ type: '"gobject"', ownership: '"none"' });
    }

    /**
     * Builds properties array for a type descriptor.
     */
    private buildProperties(type: FfiTypeDescriptor): ObjectProperty[] {
        switch (type.type) {
            case "int":
                return this.buildIntProperties(type);
            case "float":
                return this.buildFloatProperties(type);
            case "string":
                return this.buildOwnershipProperties("string", type.ownership);
            case "gobject":
                return this.buildOwnershipProperties("gobject", type.ownership);
            case "gparam":
                return this.buildOwnershipProperties("gparam", type.ownership);
            case "gvariant":
                return this.buildOwnershipProperties("gvariant", type.ownership);
            case "boxed":
                return this.buildBoxedProperties(type);
            case "struct":
                return this.buildStructProperties(type);
            case "ref":
                return this.buildRefProperties(type);
            case "array":
                return this.buildArrayProperties(type);
            case "callback":
                return this.buildCallbackProperties(type);
            case "boolean":
                return [{ name: "type", value: '"boolean"' }];
            case "undefined":
                return [{ name: "type", value: '"undefined"' }];
            case "null":
                return [{ name: "type", value: '"null"' }];
            default:
                return [{ name: "type", value: `"${type.type}"` }];
        }
    }

    private buildIntProperties(type: FfiTypeDescriptor): ObjectProperty[] {
        return [
            { name: "type", value: '"int"' },
            { name: "size", value: type.size ?? 32 },
            { name: "unsigned", value: type.unsigned ?? false },
        ];
    }

    private buildFloatProperties(type: FfiTypeDescriptor): ObjectProperty[] {
        return [
            { name: "type", value: '"float"' },
            { name: "size", value: type.size ?? 64 },
        ];
    }

    private buildOwnershipProperties(typeName: string, ownership?: "full" | "none"): ObjectProperty[] {
        const props: ObjectProperty[] = [{ name: "type", value: `"${typeName}"` }];
        props.push({ name: "ownership", value: `"${ownership ?? "full"}"` });
        return props;
    }

    private buildBoxedProperties(type: FfiTypeDescriptor): ObjectProperty[] {
        const innerType = typeof type.innerType === "string" ? type.innerType : "";

        if (innerType === "GVariant") {
            return this.buildOwnershipProperties("gvariant", type.ownership);
        }

        const lib = type.lib ?? this.options.currentSharedLibrary ?? "";
        const props: ObjectProperty[] = [{ name: "type", value: '"boxed"' }];

        props.push({ name: "ownership", value: `"${type.ownership ?? "full"}"` });

        props.push({ name: "innerType", value: `"${innerType}"` });
        props.push({ name: "lib", value: `"${lib}"` });

        if (type.getTypeFn) {
            props.push({ name: "getTypeFn", value: `"${type.getTypeFn}"` });
        }

        return props;
    }

    private buildStructProperties(type: FfiTypeDescriptor): ObjectProperty[] {
        const innerType = typeof type.innerType === "string" ? type.innerType : "";
        const props: ObjectProperty[] = [{ name: "type", value: '"struct"' }];

        props.push({ name: "ownership", value: `"${type.ownership ?? "full"}"` });

        props.push({ name: "innerType", value: `"${innerType}"` });

        return props;
    }

    private buildRefProperties(type: FfiTypeDescriptor): ObjectProperty[] {
        const props: ObjectProperty[] = [{ name: "type", value: '"ref"' }];

        if (type.innerType && typeof type.innerType !== "string") {
            props.push({ name: "innerType", value: this.toWriter(type.innerType) });
        }

        return props;
    }

    private buildArrayProperties(type: FfiTypeDescriptor): ObjectProperty[] {
        const props: ObjectProperty[] = [{ name: "type", value: '"array"' }];

        if (type.itemType) {
            props.push({ name: "itemType", value: this.toWriter(type.itemType) });
        }

        props.push({ name: "listType", value: `"${type.listType ?? "array"}"` });

        props.push({ name: "ownership", value: `"${type.ownership ?? "full"}"` });

        return props;
    }

    private buildCallbackProperties(type: FfiTypeDescriptor): ObjectProperty[] {
        const props: ObjectProperty[] = [{ name: "type", value: '"callback"' }];

        props.push({ name: "trampoline", value: `"${type.trampoline ?? "closure"}"` });

        if (type.argTypes && type.argTypes.length > 0) {
            props.push({
                name: "argTypes",
                value: (writer) => {
                    writer.write("[");
                    type.argTypes?.forEach((argType: FfiTypeDescriptor, index: number) => {
                        if (index > 0) writer.write(", ");
                        this.toWriter(argType)(writer);
                    });
                    writer.write("]");
                },
            });
        }

        if (type.sourceType) {
            props.push({ name: "sourceType", value: this.toWriter(type.sourceType) });
        }

        if (type.resultType) {
            props.push({ name: "resultType", value: this.toWriter(type.resultType) });
        }

        if (type.returnType) {
            props.push({ name: "returnType", value: this.toWriter(type.returnType) });
        }

        return props;
    }

    /**
     * Converts properties to a Writers.object-compatible object.
     * Numbers and booleans are converted to their string representations.
     */
    private propertiesToWriterObject(properties: ObjectProperty[]): Record<string, string | WriterFunction> {
        const result: Record<string, string | WriterFunction> = {};
        for (const prop of properties) {
            if (typeof prop.value === "function") {
                result[prop.name] = prop.value;
            } else if (typeof prop.value === "boolean" || typeof prop.value === "number") {
                result[prop.name] = String(prop.value);
            } else {
                result[prop.name] = prop.value;
            }
        }
        return result;
    }
}
