/**
 * FFI Type Expression Writer
 *
 * Emits TypeScript expressions that build FFI type descriptors via the
 * `t` helper namespace from `@gtkx/ffi` (e.g. `t.int8`, `t.boxed("Foo",
 * "borrowed", "libgtk-4.so.1", "gtk_foo_get_type")`). This keeps generated
 * code free of inline POJO descriptors and gives every call site a uniform,
 * compact shape.
 */

import type { Writer } from "../../builders/writer.js";
import type { FfiTypeDescriptor } from "../type-system/ffi-types.js";

const PRIMITIVE_TYPES = new Set([
    "void",
    "boolean",
    "unichar",
    "int8",
    "uint8",
    "int16",
    "uint16",
    "int32",
    "uint32",
    "int64",
    "uint64",
    "float32",
    "float64",
]);

const stringify = (value: string): string => JSON.stringify(value);

const ownership = (descriptor: FfiTypeDescriptor): string => stringify(descriptor.ownership ?? "borrowed");

/**
 * Writes a `t.<helper>(...)` expression for the given FFI type descriptor.
 *
 * Recursively expands nested types (array item types, ref inner types,
 * hashtable key/value types, callback/trampoline arg and return types).
 *
 * @param writer - Stream writer for the generated source
 * @param descriptor - FFI type descriptor to render
 */
export function writeFfiTypeExpression(writer: Writer, descriptor: FfiTypeDescriptor): void {
    if (PRIMITIVE_TYPES.has(descriptor.type)) {
        writer.write(`t.${descriptor.type}`);
        return;
    }

    switch (descriptor.type) {
        case "string":
            writer.write(`t.string(${ownership(descriptor)})`);
            return;

        case "gobject":
            writer.write(`t.object(${ownership(descriptor)})`);
            return;

        case "boxed":
            writeBoxedExpression(writer, descriptor);
            return;

        case "struct":
            writeStructExpression(writer, descriptor);
            return;

        case "fundamental":
            writeFundamentalExpression(writer, descriptor);
            return;

        case "ref":
            writer.write("t.ref(");
            writeFfiTypeExpression(writer, descriptor.innerType as FfiTypeDescriptor);
            writer.write(")");
            return;

        case "hashtable":
            writer.write("t.hashTable(");
            writeFfiTypeExpression(writer, descriptor.keyType as FfiTypeDescriptor);
            writer.write(", ");
            writeFfiTypeExpression(writer, descriptor.valueType as FfiTypeDescriptor);
            writer.write(`, ${ownership(descriptor)})`);
            return;

        case "enum":
        case "flags":
            writer.write(
                `t.${descriptor.type}(${stringify(descriptor.library ?? "")}, ${stringify(descriptor.getTypeFn ?? "")}, ${descriptor.signed === true})`,
            );
            return;

        case "array":
            writeArrayExpression(writer, descriptor);
            return;

        case "callback":
            writer.write("t.callback(");
            writeTypeArray(writer, descriptor.argTypes ?? []);
            writer.write(", ");
            writeFfiTypeExpression(writer, descriptor.returnType as FfiTypeDescriptor);
            writer.write(")");
            return;

        case "trampoline":
            writer.write("t.trampoline(");
            writeTypeArray(writer, descriptor.argTypes ?? []);
            writer.write(", ");
            writeFfiTypeExpression(writer, descriptor.returnType as FfiTypeDescriptor);
            writeTrampolineOptions(writer, descriptor);
            writer.write(")");
            return;

        default:
            writer.write(JSON.stringify(descriptor));
    }
}

function writeBoxedExpression(writer: Writer, descriptor: FfiTypeDescriptor): void {
    const inner = typeof descriptor.innerType === "string" ? descriptor.innerType : "";
    writer.write(`t.boxed(${stringify(inner)}, ${ownership(descriptor)}`);
    if (descriptor.library !== undefined) {
        writer.write(`, ${stringify(descriptor.library)}`);
        if (descriptor.getTypeFn !== undefined) {
            writer.write(`, ${stringify(descriptor.getTypeFn)}`);
        }
    } else if (descriptor.getTypeFn !== undefined) {
        writer.write(`, undefined, ${stringify(descriptor.getTypeFn)}`);
    }
    writer.write(")");
}

function writeStructExpression(writer: Writer, descriptor: FfiTypeDescriptor): void {
    const inner = typeof descriptor.innerType === "string" ? descriptor.innerType : "";
    writer.write(`t.struct(${stringify(inner)}, ${ownership(descriptor)}`);
    if (descriptor.size !== undefined) {
        writer.write(`, ${descriptor.size}`);
    }
    writer.write(")");
}

function writeFundamentalExpression(writer: Writer, descriptor: FfiTypeDescriptor): void {
    writer.write(
        `t.fundamental(${stringify(descriptor.library ?? "")}, ${stringify(descriptor.refFn ?? "")}, ${stringify(descriptor.unrefFn ?? "")}, ${ownership(descriptor)}`,
    );
    if (descriptor.typeName !== undefined) {
        writer.write(`, ${stringify(descriptor.typeName)}`);
    }
    writer.write(")");
}

function writeArrayExpression(writer: Writer, descriptor: FfiTypeDescriptor): void {
    const item = descriptor.itemType as FfiTypeDescriptor;
    const own = ownership(descriptor);
    const kind = descriptor.kind ?? "array";

    switch (kind) {
        case "glist":
            writer.write("t.list(");
            writeFfiTypeExpression(writer, item);
            writer.write(`, ${own})`);
            return;
        case "gslist":
            writer.write("t.slist(");
            writeFfiTypeExpression(writer, item);
            writer.write(`, ${own})`);
            return;
        case "gptrarray":
            writer.write("t.ptrArray(");
            writeFfiTypeExpression(writer, item);
            writer.write(`, ${own})`);
            return;
        case "garray":
            writer.write("t.gArray(");
            writeFfiTypeExpression(writer, item);
            writer.write(`, ${own}`);
            if (descriptor.elementSize !== undefined) {
                writer.write(`, ${descriptor.elementSize}`);
            }
            writer.write(")");
            return;
        case "gbytearray":
            writer.write(`t.byteArray(${own})`);
            return;
        case "sized":
            writer.write("t.sizedArray(");
            writeFfiTypeExpression(writer, item);
            writer.write(`, ${descriptor.sizeParamIndex ?? 0}, ${own})`);
            return;
        case "fixed":
            writer.write("t.fixedArray(");
            writeFfiTypeExpression(writer, item);
            writer.write(`, ${descriptor.fixedSize ?? 0}, ${own})`);
            return;
        default:
            writer.write("t.array(");
            writeFfiTypeExpression(writer, item);
            writer.write(`, ${stringify(kind)}, ${own}`);
            writeArrayOptions(writer, descriptor);
            writer.write(")");
    }
}

function writeArrayOptions(writer: Writer, descriptor: FfiTypeDescriptor): void {
    const opts: string[] = [];
    if (descriptor.elementSize !== undefined) opts.push(`elementSize: ${descriptor.elementSize}`);
    if (descriptor.sizeParamIndex !== undefined) opts.push(`sizeParamIndex: ${descriptor.sizeParamIndex}`);
    if (descriptor.fixedSize !== undefined) opts.push(`fixedSize: ${descriptor.fixedSize}`);
    if (opts.length === 0) return;
    writer.write(`, { ${opts.join(", ")} }`);
}

function writeTrampolineOptions(writer: Writer, descriptor: FfiTypeDescriptor): void {
    const opts: string[] = [];
    if (descriptor.hasDestroy === true) opts.push("hasDestroy: true");
    if (descriptor.userDataIndex !== undefined) opts.push(`userDataIndex: ${descriptor.userDataIndex}`);
    if (descriptor.scope !== undefined) opts.push(`scope: ${stringify(descriptor.scope)}`);
    if (opts.length === 0) return;
    writer.write(`, { ${opts.join(", ")} }`);
}

function writeTypeArray(writer: Writer, types: readonly FfiTypeDescriptor[]): void {
    if (types.length === 0) {
        writer.write("[]");
        return;
    }
    writer.write("[");
    for (let i = 0; i < types.length; i++) {
        if (i > 0) writer.write(", ");
        const type = types[i];
        if (type !== undefined) writeFfiTypeExpression(writer, type);
    }
    writer.write("]");
}

/**
 * Renders a type expression to a string. Convenience wrapper around
 * {@link writeFfiTypeExpression} for callers that want a string instead of
 * streaming into a Writer.
 *
 * @param descriptor - FFI type descriptor to render
 * @param writerFactory - Factory returning a fresh Writer
 * @returns The rendered expression
 */
export function renderFfiTypeExpression(descriptor: FfiTypeDescriptor, writerFactory: () => Writer): string {
    const writer = writerFactory();
    writeFfiTypeExpression(writer, descriptor);
    return writer.toString();
}
